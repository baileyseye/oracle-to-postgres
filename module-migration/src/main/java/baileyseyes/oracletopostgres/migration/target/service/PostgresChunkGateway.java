package baileyseyes.oracletopostgres.migration.target.service;

import baileyseyes.oracletopostgres.migration.common.exception.MigrationConflictException;
import baileyseyes.oracletopostgres.migration.common.exception.MigrationException;
import baileyseyes.oracletopostgres.migration.common.exception.TargetAccessException;
import baileyseyes.oracletopostgres.migration.service.row.OrderRow;
import baileyseyes.oracletopostgres.migration.service.row.UserRow;
import baileyseyes.oracletopostgres.migration.target.config.MigrationTargetProperties;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Постраничная запись источника в PostgreSQL через временные staging-таблицы.
 * <br>
 * Память ограничена размером одного чанка: строки не накапливаются.
 * Сопоставление source id → target id, adoption по натуральному ключу
 * и поиск исчезнувших строк выполняются SQL внутри PostgreSQL.
 * <br>
 * Все методы должны вызываться в транзакции {@code targetTransactionManager}:
 * временные таблицы живут в рамках соединения и текущей транзакции.
 */
@Slf4j
@Service
public class PostgresChunkGateway {

    private static final String USER_STAGE_TABLE = "migration_stage_users";
    private static final String ORDER_STAGE_TABLE = "migration_stage_orders";

    private final JdbcTemplate targetJdbcTemplate;
    private final String usersTable;
    private final String ordersTable;
    private final String mappingTable;

    public PostgresChunkGateway(@Qualifier("targetJdbcTemplate") JdbcTemplate targetJdbcTemplate,
                                MigrationTargetProperties properties) {
        this.targetJdbcTemplate = targetJdbcTemplate;
        this.usersTable = qualifiedTable(properties.getSchema(), "users");
        this.ordersTable = qualifiedTable(properties.getSchema(), "orders");
        this.mappingTable = qualifiedTable(properties.getSchema(), "migration_entity_map");
    }

    /**
     * Создаёт временную staging-таблицу пользователей и очищает её.
     */
    public void prepareUserStaging() {
        requireTargetTransaction();
        execute("CREATE TEMP TABLE IF NOT EXISTS " + USER_STAGE_TABLE + " ("
            + "source_id BIGINT PRIMARY KEY"
            + ",username VARCHAR(100) NOT NULL"
            + ",email VARCHAR(255) NOT NULL"
            + ",created_at TIMESTAMP NOT NULL"
            + ",updated_at TIMESTAMP NOT NULL"
            + ") ON COMMIT DROP");
        clearUserStaging();
    }

    /**
     * Загружает один чанк пользователей в staging.
     */
    public void stageUsers(List<UserRow> rows) {
        clearUserStaging();
        List<Object[]> arguments = new ArrayList<>(rows.size());

        for (UserRow row : rows) {
            arguments.add(new Object[]{
                row.sourceId(),
                row.username(),
                row.email(),
                Timestamp.valueOf(row.createdAt()),
                Timestamp.valueOf(row.updatedAt())
            });
        }

        try {
            targetJdbcTemplate.batchUpdate(
                "INSERT INTO " + USER_STAGE_TABLE
                    + " (source_id, username, email, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                arguments);
        } catch (DataIntegrityViolationException exception) {
            throw new MigrationConflictException(
                "Конфликт данных в staging-таблице пользователей", exception);
        } catch (DataAccessException exception) {
            throw new TargetAccessException(
                "Не удалось загрузить чанк пользователей в staging", exception);
        }
    }

    /**
     * Применяет staging-чанк пользователей к целевой таблице.
     * <br>
     * Порядок шагов: сначала обновляются сопоставленные строки,
     * затем удаляются битые соответствия, затем выполняется adoption
     * по username, вставка новых строк и фиксация source id в текущем запуске.
     */
    public ChunkResult applyUserChunk(long runId) {
        try {
            deleteOrphanUserMappings();

            long updated = targetJdbcTemplate.update(
                "UPDATE " + usersTable + " u"
                    + " SET username = s.username, email = s.email,"
                    + " created_at = s.created_at, updated_at = s.updated_at"
                    + " FROM " + mappingTable + " m"
                    + " JOIN " + USER_STAGE_TABLE + " s ON s.source_id = m.source_id"
                    + " WHERE m.entity_type = 'USER' AND m.target_id = u.id");

            updated += targetJdbcTemplate.update(
                "UPDATE " + usersTable + " u"
                    + " SET username = s.username, email = s.email,"
                    + " created_at = s.created_at, updated_at = s.updated_at"
                    + " FROM " + USER_STAGE_TABLE + " s"
                    + " WHERE u.username = s.username"
                    + " AND NOT EXISTS (SELECT 1 FROM " + mappingTable + " m"
                    + " WHERE m.entity_type = 'USER' AND m.source_id = s.source_id)"
                    + " AND NOT EXISTS (SELECT 1 FROM " + mappingTable + " m2"
                    + " WHERE m2.entity_type = 'USER' AND m2.target_id = u.id)");

            long inserted = targetJdbcTemplate.update(
                "INSERT INTO " + usersTable + " (username, email, created_at, updated_at)"
                    + " SELECT s.username, s.email, s.created_at, s.updated_at"
                    + " FROM " + USER_STAGE_TABLE + " s"
                    + " WHERE NOT EXISTS (SELECT 1 FROM " + mappingTable + " m"
                    + " WHERE m.entity_type = 'USER' AND m.source_id = s.source_id)"
                    + " AND NOT EXISTS (SELECT 1 FROM " + usersTable + " u WHERE u.username = s.username)");

            insertMissingUserMappings(runId);
            requireAllUsersMapped();
            markSeenUserMappings(runId);

            return new ChunkResult(inserted, updated);
        } catch (DataIntegrityViolationException exception) {
            throw new MigrationConflictException(
                "Чанк пользователей конфликтует с ограничениями PostgreSQL "
                    + "(уникальность username/email или внешний ключ)", exception);
        } catch (DataAccessException exception) {
            throw new TargetAccessException(
                "Не удалось применить чанк пользователей в PostgreSQL", exception);
        }
    }

    /**
     * Удаляет пользователей, которые были перенесены ранее,
     * но не встретились в текущем запуске.
     * <br>
     * Вызывается после удаления устаревших заказов, чтобы не нарушить FK.
     */
    public long deleteStaleUsers(long runId) {
        try {
            long deleted = targetJdbcTemplate.update(
                "DELETE FROM " + usersTable + " u"
                    + " USING " + mappingTable + " m"
                    + " WHERE m.entity_type = 'USER' AND m.target_id = u.id"
                    + " AND m.last_seen_run IS DISTINCT FROM ?", runId);

            targetJdbcTemplate.update(
                "DELETE FROM " + mappingTable
                    + " WHERE entity_type = 'USER' AND last_seen_run IS DISTINCT FROM ?", runId);

            log.info("Удалено пользователей, исчезнувших из Oracle: {}", deleted);
            return deleted;
        } catch (DataIntegrityViolationException exception) {
            throw new MigrationConflictException(
                "Нельзя удалить пользователей, исчезнувших из Oracle: "
                    + "на них ссылаются заказы в PostgreSQL", exception);
        } catch (DataAccessException exception) {
            throw new TargetAccessException(
                "Не удалось удалить пользователей, исчезнувших из Oracle", exception);
        }
    }

    /**
     * Создаёт временную staging-таблицу заказов и очищает её перед запуском.
     */
    public void prepareOrderStaging() {
        requireTargetTransaction();
        execute("CREATE TEMP TABLE IF NOT EXISTS " + ORDER_STAGE_TABLE + " ("
            + "source_id BIGINT PRIMARY KEY"
            + ",source_user_id BIGINT NOT NULL"
            + ",target_user_id BIGINT"
            + ",order_number VARCHAR(50) NOT NULL"
            + ",amount NUMERIC(12,2) NOT NULL"
            + ",status VARCHAR(20) NOT NULL"
            + ",created_at TIMESTAMP NOT NULL"
            + ") ON COMMIT DROP");
        clearOrderStaging();
    }

    /**
     * Загружает один чанк заказов в staging.
     */
    public void stageOrders(List<OrderRow> rows) {
        clearOrderStaging();
        List<Object[]> arguments = new ArrayList<>(rows.size());

        for (OrderRow row : rows) {
            arguments.add(new Object[]{
                row.sourceId(),
                row.sourceUserId(),
                row.orderNumber(),
                row.amount(),
                row.status(),
                Timestamp.valueOf(row.createdAt())
            });
        }

        try {
            targetJdbcTemplate.batchUpdate(
                "INSERT INTO " + ORDER_STAGE_TABLE
                    + " (source_id, source_user_id, order_number, amount, status, created_at)"
                    + " VALUES (?, ?, ?, ?, ?, ?)",
                arguments);
        } catch (DataIntegrityViolationException exception) {
            throw new MigrationConflictException(
                "Конфликт данных в staging-таблице заказов", exception);
        } catch (DataAccessException exception) {
            throw new TargetAccessException(
                "Не удалось загрузить чанк заказов в staging", exception);
        }
    }

    /**
     * Применяет staging-чанк заказов к целевой таблице.
     * <br>
     * Целевой пользователь разрешается join-ом с {@code migration_entity_map}:
     * в Java больше не хранится карта на сотни миллионов пользователей.
     */
    public ChunkResult applyOrderChunk(long runId) {
        try {
            resolveOrderUsers(runId);
            requireOrderUsersResolved();
            deleteOrphanOrderMappings();

            long updated = targetJdbcTemplate.update(
                "UPDATE " + ordersTable + " o"
                    + " SET user_id = s.target_user_id, order_number = s.order_number,"
                    + " amount = s.amount, status = s.status, created_at = s.created_at"
                    + " FROM " + mappingTable + " m"
                    + " JOIN " + ORDER_STAGE_TABLE + " s ON s.source_id = m.source_id"
                    + " WHERE m.entity_type = 'ORDER' AND m.target_id = o.id");

            updated += targetJdbcTemplate.update(
                "UPDATE " + ordersTable + " o"
                    + " SET user_id = s.target_user_id, order_number = s.order_number,"
                    + " amount = s.amount, status = s.status, created_at = s.created_at"
                    + " FROM " + ORDER_STAGE_TABLE + " s"
                    + " WHERE o.order_number = s.order_number"
                    + " AND NOT EXISTS (SELECT 1 FROM " + mappingTable + " m"
                    + " WHERE m.entity_type = 'ORDER' AND m.source_id = s.source_id)"
                    + " AND NOT EXISTS (SELECT 1 FROM " + mappingTable + " m2"
                    + " WHERE m2.entity_type = 'ORDER' AND m2.target_id = o.id)");

            long inserted = targetJdbcTemplate.update(
                "INSERT INTO " + ordersTable + " (user_id, order_number, amount, status, created_at)"
                    + " SELECT s.target_user_id, s.order_number, s.amount, s.status, s.created_at"
                    + " FROM " + ORDER_STAGE_TABLE + " s"
                    + " WHERE NOT EXISTS (SELECT 1 FROM " + mappingTable + " m"
                    + " WHERE m.entity_type = 'ORDER' AND m.source_id = s.source_id)"
                    + " AND NOT EXISTS (SELECT 1 FROM " + ordersTable + " o"
                    + " WHERE o.order_number = s.order_number)");

            insertMissingOrderMappings(runId);
            requireAllOrdersMapped();
            markSeenOrderMappings(runId);

            return new ChunkResult(inserted, updated);
        } catch (DataIntegrityViolationException exception) {
            throw new MigrationConflictException(
                "Чанк заказов конфликтует с ограничениями PostgreSQL "
                    + "(уникальность order_number, внешний ключ или check-constraint)", exception);
        } catch (DataAccessException exception) {
            throw new TargetAccessException(
                "Не удалось применить чанк заказов в PostgreSQL", exception);
        }
    }

    /**
     * Удаляет заказы, которые были перенесены ранее,
     * но не встретились в текущем запуске.
     */
    public long deleteStaleOrders(long runId) {
        try {
            long deleted = targetJdbcTemplate.update(
                "DELETE FROM " + ordersTable + " o"
                    + " USING " + mappingTable + " m"
                    + " WHERE m.entity_type = 'ORDER' AND m.target_id = o.id"
                    + " AND m.last_seen_run IS DISTINCT FROM ?", runId);

            targetJdbcTemplate.update(
                "DELETE FROM " + mappingTable
                    + " WHERE entity_type = 'ORDER' AND last_seen_run IS DISTINCT FROM ?", runId);

            return deleted;
        } catch (DataIntegrityViolationException exception) {
            throw new MigrationConflictException(
                "Нельзя удалить заказы, исчезнувшие из Oracle: "
                    + "на них ссылаются дочерние записи в PostgreSQL", exception);
        } catch (DataAccessException exception) {
            throw new TargetAccessException(
                "Не удалось удалить заказы, исчезнувшие из Oracle", exception);
        }
    }

    private void resolveOrderUsers(long runId) {
        targetJdbcTemplate.update(
            "UPDATE " + ORDER_STAGE_TABLE + " s"
                + " SET target_user_id = m.target_id"
                + " FROM " + mappingTable + " m"
                + " WHERE m.entity_type = 'USER' AND m.source_id = s.source_user_id"
                + " AND m.last_seen_run = ?", runId);
    }

    private void requireOrderUsersResolved() {
        List<UnresolvedOrder> unresolved = targetJdbcTemplate.query(
            "SELECT s.source_id, s.order_number, s.source_user_id"
                + " FROM " + ORDER_STAGE_TABLE + " s"
                + " WHERE s.target_user_id IS NULL LIMIT 1",
            (resultSet, rowNumber) -> new UnresolvedOrder(
                resultSet.getLong("source_id"),
                resultSet.getString("order_number"),
                resultSet.getLong("source_user_id")));

        if (!unresolved.isEmpty()) {
            UnresolvedOrder order = unresolved.getFirst();
            throw new MigrationException("Для заказа '" + order.orderNumber() + "' (source id="
                + order.sourceId() + ") не найден пользователь с исходным id="
                + order.sourceUserId() + " в карте миграции");
        }
    }

    private void deleteOrphanUserMappings() {
        targetJdbcTemplate.update(
            "DELETE FROM " + mappingTable + " m"
                + " WHERE m.entity_type = 'USER'"
                + " AND EXISTS (SELECT 1 FROM " + USER_STAGE_TABLE + " s WHERE s.source_id = m.source_id)"
                + " AND NOT EXISTS (SELECT 1 FROM " + usersTable + " u WHERE u.id = m.target_id)");
    }

    private void insertMissingUserMappings(long runId) {
        targetJdbcTemplate.update(
            "INSERT INTO " + mappingTable
                + " (entity_type, source_id, target_id, source_key, last_seen_run, updated_at)"
                + " SELECT 'USER', s.source_id, u.id, s.username, ?, CURRENT_TIMESTAMP"
                + " FROM " + USER_STAGE_TABLE + " s"
                + " JOIN " + usersTable + " u ON u.username = s.username"
                + " WHERE NOT EXISTS (SELECT 1 FROM " + mappingTable + " m"
                + " WHERE m.entity_type = 'USER' AND m.source_id = s.source_id)"
                + " AND NOT EXISTS (SELECT 1 FROM " + mappingTable + " m2"
                + " WHERE m2.entity_type = 'USER' AND m2.target_id = u.id)"
                + " ON CONFLICT (entity_type, source_id) DO NOTHING", runId);
    }

    private void requireAllUsersMapped() {
        List<Long> unmapped = targetJdbcTemplate.query(
            "SELECT s.source_id FROM " + USER_STAGE_TABLE + " s"
                + " LEFT JOIN " + mappingTable + " m"
                + " ON m.entity_type = 'USER' AND m.source_id = s.source_id"
                + " WHERE m.source_id IS NULL LIMIT 1",
            (resultSet, rowNumber) -> resultSet.getLong("source_id"));

        if (!unmapped.isEmpty()) {
            throw new MigrationConflictException("Не удалось сопоставить пользователя source id="
                + unmapped.getFirst() + " с уникальной целевой строкой: username уже занят "
                + "другим пользователем или не может быть вставлен");
        }
    }

    private void markSeenUserMappings(long runId) {
        targetJdbcTemplate.update(
            "UPDATE " + mappingTable + " m"
                + " SET source_key = s.username, last_seen_run = ?, updated_at = CURRENT_TIMESTAMP"
                + " FROM " + USER_STAGE_TABLE + " s"
                + " WHERE m.entity_type = 'USER' AND m.source_id = s.source_id", runId);
    }

    private void deleteOrphanOrderMappings() {
        targetJdbcTemplate.update(
            "DELETE FROM " + mappingTable + " m"
                + " WHERE m.entity_type = 'ORDER'"
                + " AND EXISTS (SELECT 1 FROM " + ORDER_STAGE_TABLE + " s WHERE s.source_id = m.source_id)"
                + " AND NOT EXISTS (SELECT 1 FROM " + ordersTable + " o WHERE o.id = m.target_id)");
    }

    private void insertMissingOrderMappings(long runId) {
        targetJdbcTemplate.update(
            "INSERT INTO " + mappingTable
                + " (entity_type, source_id, target_id, source_key, last_seen_run, updated_at)"
                + " SELECT 'ORDER', s.source_id, o.id, s.order_number, ?, CURRENT_TIMESTAMP"
                + " FROM " + ORDER_STAGE_TABLE + " s"
                + " JOIN " + ordersTable + " o ON o.order_number = s.order_number"
                + " WHERE NOT EXISTS (SELECT 1 FROM " + mappingTable + " m"
                + " WHERE m.entity_type = 'ORDER' AND m.source_id = s.source_id)"
                + " AND NOT EXISTS (SELECT 1 FROM " + mappingTable + " m2"
                + " WHERE m2.entity_type = 'ORDER' AND m2.target_id = o.id)"
                + " ON CONFLICT (entity_type, source_id) DO NOTHING", runId);
    }

    private void requireAllOrdersMapped() {
        List<Long> unmapped = targetJdbcTemplate.query(
            "SELECT s.source_id FROM " + ORDER_STAGE_TABLE + " s"
                + " LEFT JOIN " + mappingTable + " m"
                + " ON m.entity_type = 'ORDER' AND m.source_id = s.source_id"
                + " WHERE m.source_id IS NULL LIMIT 1",
            (resultSet, rowNumber) -> resultSet.getLong("source_id"));

        if (!unmapped.isEmpty()) {
            throw new MigrationConflictException("Не удалось сопоставить заказ source id="
                + unmapped.getFirst() + " с уникальной целевой строкой: order_number уже занят "
                + "другим заказом или не может быть вставлен");
        }
    }

    private void markSeenOrderMappings(long runId) {
        targetJdbcTemplate.update(
            "UPDATE " + mappingTable + " m"
                + " SET source_key = s.order_number, last_seen_run = ?, updated_at = CURRENT_TIMESTAMP"
                + " FROM " + ORDER_STAGE_TABLE + " s"
                + " WHERE m.entity_type = 'ORDER' AND m.source_id = s.source_id", runId);
    }

    private void clearUserStaging() {
        execute("TRUNCATE TABLE " + USER_STAGE_TABLE);
    }

    private void clearOrderStaging() {
        execute("TRUNCATE TABLE " + ORDER_STAGE_TABLE);
    }

    private void requireTargetTransaction() {
        if (!TransactionSynchronizationManager.isActualTransactionActive()) {
            throw new MigrationException(
                "Постраничная миграция должна выполняться в транзакции "
                    + "targetTransactionManager: staging-таблицы привязаны к соединению");
        }
    }

    private void execute(String sql) {
        try {
            targetJdbcTemplate.execute(sql);
        } catch (DataAccessException exception) {
            throw new TargetAccessException(
                "Не удалось подготовить staging-таблицу миграции", exception);
        }
    }

    private String qualifiedTable(String schema, String table) {
        if (schema == null || schema.isBlank()) {
            return quote(table);
        }

        return quote(schema) + "." + quote(table);
    }

    private String quote(String identifier) {
        return "\"" + identifier.replace("\"", "\"\"") + "\"";
    }

    private record UnresolvedOrder(long sourceId, String orderNumber, long sourceUserId) {
    }
}

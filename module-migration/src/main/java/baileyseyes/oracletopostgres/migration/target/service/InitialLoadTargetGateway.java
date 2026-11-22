package baileyseyes.oracletopostgres.migration.target.service;

import baileyseyes.oracletopostgres.migration.common.exception.MigrationConflictException;
import baileyseyes.oracletopostgres.migration.common.exception.MigrationException;
import baileyseyes.oracletopostgres.migration.common.exception.TargetAccessException;
import baileyseyes.oracletopostgres.migration.service.row.OrderRow;
import baileyseyes.oracletopostgres.migration.service.row.UserRow;
import baileyseyes.oracletopostgres.migration.target.config.MigrationTargetProperties;
import java.io.IOException;
import java.io.StringReader;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.postgresql.PGConnection;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Шлюз быстрой первичной загрузки в PostgreSQL.
 * <br>
 * Использует {@code COPY}, сохраняет source id и не выполняет upsert/adoption.
 * Каждый чанк должен вызываться в отдельной транзакции target-БД.
 */
@Slf4j
@Service
public class InitialLoadTargetGateway {

    private static final String USERS_TABLE = "users";
    private static final String ORDERS_TABLE = "orders";
    private static final String MAPPING_TABLE = "migration_entity_map";

    private final JdbcTemplate targetJdbcTemplate;
    private final TransactionTemplate targetTransactionTemplate;
    private final String schema;
    private final String usersTable;
    private final String ordersTable;
    private final String mappingTable;

    public InitialLoadTargetGateway(@Qualifier("targetJdbcTemplate") JdbcTemplate targetJdbcTemplate,
                                    MigrationTargetProperties properties,
                                    TransactionTemplate targetTransactionTemplate) {
        this.targetJdbcTemplate = targetJdbcTemplate;
        this.targetTransactionTemplate = targetTransactionTemplate;
        this.schema = properties.getSchema();
        this.usersTable = qualifiedTable(schema, USERS_TABLE);
        this.ordersTable = qualifiedTable(schema, ORDERS_TABLE);
        this.mappingTable = qualifiedTable(schema, MAPPING_TABLE);
    }

    /**
     * Готовит target к первичной загрузке.
     *
     * @param truncateTarget очистить таблицы перед загрузкой
     * @param resume         продолжить прерванную загрузку с {@code MAX(id)}
     */
    public void prepareTarget(boolean truncateTarget, boolean resume) {
        if (truncateTarget && resume) {
            throw new MigrationException(
                "Нельзя одновременно задать truncate-target=true и resume=true");
        }

        try {
            if (truncateTarget) {
                List<String> tables = new ArrayList<>(List.of(usersTable, ordersTable));

                if (tableExists(MAPPING_TABLE)) {
                    tables.add(mappingTable);
                }

                log.warn("Initial-load очищает target-таблицы: {}", tables);
                targetJdbcTemplate.execute("TRUNCATE TABLE " + String.join(", ", tables) + " RESTART IDENTITY");
                return;
            }

            if (resume) {
                return;
            }

            requireEmpty(usersTable, USERS_TABLE);
            requireEmpty(ordersTable, ORDERS_TABLE);

            if (tableExists(MAPPING_TABLE)) {
                requireEmpty(mappingTable, MAPPING_TABLE);
            }
        } catch (DataAccessException exception) {
            throw new TargetAccessException(
                "Не удалось подготовить target к первичной загрузке", exception);
        }
    }

    /**
     * Возвращает MAX ключа в диапазоне или {@link Long#MIN_VALUE}, если строк нет.
     */
    public long maxKeyBetween(String table, String column, long from, long to) {
        String columnName = quoteColumn(column);

        try {
            Long max = targetJdbcTemplate.queryForObject(
                "SELECT MAX(" + columnName + ") FROM " + qualifiedTable(table)
                    + " WHERE " + columnName + " BETWEEN ? AND ?",
                Long.class, from, to);

            return max == null ? Long.MIN_VALUE : max;
        } catch (DataAccessException exception) {
            throw new TargetAccessException("Не удалось прочитать MAX(" + column
                + ") таблицы '" + table + "' в диапазоне", exception);
        }
    }

    /**
     * Загружает чанк пользователей через COPY, сохраняя source id.
     */
    public long copyUsers(List<UserRow> rows) {
        StringBuilder csv = new StringBuilder(rows.size() * 160);

        for (UserRow row : rows) {
            csv.append(row.sourceId()).append(',')
                .append(csv(row.username())).append(',')
                .append(csv(row.email())).append(',')
                .append(timestamp(row.createdAt())).append(',')
                .append(timestamp(row.updatedAt())).append('\n');
        }

        return copy(usersTable, "id, username, email, created_at, updated_at", csv);
    }

    /**
     * Загружает чанк заказов через COPY, сохраняя source id и source user id.
     */
    public long copyOrders(List<OrderRow> rows) {
        StringBuilder csv = new StringBuilder(rows.size() * 160);

        for (OrderRow row : rows) {
            csv.append(row.sourceId()).append(',')
                .append(row.sourceUserId()).append(',')
                .append(csv(row.orderNumber())).append(',')
                .append(row.amount().toPlainString()).append(',')
                .append(csv(row.status())).append(',')
                .append(timestamp(row.createdAt())).append('\n');
        }

        return copy(ordersTable, "id, user_id, order_number, amount, status, created_at", csv);
    }

    /**
     * Заполняет служебную карту для последующего mirror-режима.
     * <br>
     * При сохранении source id соответствие тривиально: source_id = target_id.
     */
    public void populateMapping(boolean mappingEmpty) {
        if (!tableExists(MAPPING_TABLE)) {
            throw new TargetAccessException("Таблица migration_entity_map отсутствует. "
                + "Создайте схему или отключите populate-mapping.");
        }

        String conflictClause = mappingEmpty
            ? ""
            : " ON CONFLICT (entity_type, source_id) DO NOTHING";

        try {
            targetTransactionTemplate.executeWithoutResult(status -> {
                targetJdbcTemplate.update(
                    "INSERT INTO " + mappingTable
                        + " (entity_type, source_id, target_id, source_key, last_seen_run, updated_at)"
                        + " SELECT 'USER', id, id, username, NULL, CURRENT_TIMESTAMP FROM " + usersTable
                        + conflictClause);

                targetJdbcTemplate.update(
                    "INSERT INTO " + mappingTable
                        + " (entity_type, source_id, target_id, source_key, last_seen_run, updated_at)"
                        + " SELECT 'ORDER', id, id, order_number, NULL, CURRENT_TIMESTAMP FROM " + ordersTable
                        + conflictClause);
            });
        } catch (DataAccessException exception) {
            throw new TargetAccessException("Не удалось заполнить migration_entity_map", exception);
        }
    }

    /**
     * Обновляет статистику планировщика после загрузки.
     */
    public void analyze(String table) {
        try {
            targetJdbcTemplate.execute("ANALYZE " + qualifiedTable(table));
        } catch (DataAccessException exception) {
            throw new TargetAccessException(
                "Не удалось выполнить ANALYZE таблицы '" + table + "'", exception);
        }
    }

    private long copy(String table, String columns, CharSequence data) {
        String sql = "COPY " + table + " (" + columns + ") FROM STDIN WITH (FORMAT csv, NULL '')";

        try {
            Long copied = targetJdbcTemplate.execute((ConnectionCallback<Long>) connection -> {
                try {
                    PGConnection pgConnection = connection.unwrap(PGConnection.class);
                    return pgConnection.getCopyAPI().copyIn(sql, new StringReader(data.toString()));
                } catch (IOException exception) {
                    throw new SQLException("Не удалось прочитать CSV для COPY", exception);
                }
            });

            return copied == null ? 0 : copied;
        } catch (DataIntegrityViolationException exception) {
            throw new MigrationConflictException("COPY в таблицу '" + table
                + "' нарушает уникальность, FK или check-constraint", exception);
        } catch (DataAccessException exception) {
            throw new TargetAccessException(
                "Не удалось выполнить COPY в таблицу '" + table + "'", exception);
        }
    }

    private void requireEmpty(String table, String displayName) {
        Boolean exists = targetJdbcTemplate.queryForObject(
            "SELECT EXISTS (SELECT 1 FROM " + table + ")", Boolean.class);

        if (Boolean.TRUE.equals(exists)) {
            throw new MigrationConflictException("Таблица '" + displayName + "' не пуста. "
                + "Задайте migration.initial-load.truncate-target=true, очистите таблицы "
                + "вручную или продолжите загрузку с resume=true.");
        }
    }

    private boolean tableExists(String table) {
        String schemaFilter = schema == null || schema.isBlank() ? null : schema;

        Integer count = targetJdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM information_schema.tables"
                + " WHERE table_schema = COALESCE(?, current_schema()) AND table_name = ?",
            Integer.class, schemaFilter, table);

        return count != null && count > 0;
    }

    private String csv(String value) {
        return value == null ? "" : "\"" + value.replace("\"", "\"\"") + "\"";
    }

    private String timestamp(LocalDateTime value) {
        return Timestamp.valueOf(value).toString();
    }

    private String qualifiedTable(String table) {
        if (USERS_TABLE.equalsIgnoreCase(table)) {
            return usersTable;
        }

        if (ORDERS_TABLE.equalsIgnoreCase(table)) {
            return ordersTable;
        }

        if (MAPPING_TABLE.equalsIgnoreCase(table)) {
            return mappingTable;
        }

        throw new MigrationException("Неизвестная таблица миграции: " + table);
    }

    private String quoteColumn(String column) {
        if (column == null || !column.matches("[A-Za-z_][A-Za-z0-9_]*")) {
            throw new MigrationException("Недопустимое имя колонки: " + column);
        }

        return "\"" + column.replace("\"", "\"\"") + "\"";
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
}

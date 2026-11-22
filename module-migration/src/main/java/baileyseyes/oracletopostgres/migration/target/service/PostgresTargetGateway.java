package baileyseyes.oracletopostgres.migration.target.service;

import baileyseyes.oracletopostgres.migration.common.exception.MigrationConflictException;
import baileyseyes.oracletopostgres.migration.common.exception.TargetAccessException;
import baileyseyes.oracletopostgres.migration.common.support.CheckConstraintMetadata;
import baileyseyes.oracletopostgres.migration.common.support.ColumnMetadata;
import baileyseyes.oracletopostgres.migration.common.support.ForeignKeyMetadata;
import baileyseyes.oracletopostgres.migration.common.support.IndexMetadata;
import baileyseyes.oracletopostgres.migration.common.support.JdbcTableMetadataReader;
import baileyseyes.oracletopostgres.migration.common.support.MigrationEntity;
import baileyseyes.oracletopostgres.migration.common.support.PrimaryKeyMetadata;
import baileyseyes.oracletopostgres.migration.target.config.MigrationTargetProperties;
import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import javax.sql.DataSource;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * Шлюз записи в PostgreSQL-приёмник.
 * <br>
 * Имена таблиц фиксированы в коде миграции, схема берётся из конфигурации.
 * Все ошибки драйвера оборачиваются в прикладные исключения сервиса миграции.
 */
@Service
public class PostgresTargetGateway {

    private static final String USERS_TABLE = "users";
    private static final String ORDERS_TABLE = "orders";
    private static final String MAPPING_TABLE = "migration_entity_map";

    private final JdbcTemplate targetJdbcTemplate;
    private final DataSource targetDataSource;
    private final MigrationTargetProperties properties;

    public PostgresTargetGateway(@Qualifier("targetJdbcTemplate") JdbcTemplate targetJdbcTemplate,
                                 @Qualifier("targetDataSource") DataSource targetDataSource,
                                 MigrationTargetProperties properties) {
        this.targetJdbcTemplate = targetJdbcTemplate;
        this.targetDataSource = targetDataSource;
        this.properties = properties;
    }

    /**
     * Возвращает таблицы схемы приёмника.
     */
    public List<String> listTables() {
        try (Connection connection = targetDataSource.getConnection()) {
            return readTableNames(connection);
        } catch (SQLException exception) {
            throw new TargetAccessException("Не удалось получить список таблиц PostgreSQL", exception);
        }
    }

    /**
     * Возвращает индексы таблицы приёмника.
     */
    public List<IndexMetadata> listIndexes(String table) {
        try (Connection connection = targetDataSource.getConnection()) {
            String resolvedTable = resolveTableName(connection, table);
            return JdbcTableMetadataReader.readIndexes(connection, effectiveSchema(connection), resolvedTable);
        } catch (SQLException exception) {
            throw new TargetAccessException("Не удалось получить индексы таблицы '" + table + "' в PostgreSQL", exception);
        }
    }

    public List<ColumnMetadata> listColumnMetadata(String table) {
        try (Connection connection = targetDataSource.getConnection()) {
            String resolvedTable = resolveTableName(connection, table);
            return JdbcTableMetadataReader.readColumns(connection, effectiveSchema(connection), resolvedTable);
        } catch (SQLException exception) {
            throw new TargetAccessException(
                "Не удалось получить метаданные колонок таблицы '" + table + "' в PostgreSQL", exception);
        }
    }

    public Optional<PrimaryKeyMetadata> primaryKey(String table) {
        try (Connection connection = targetDataSource.getConnection()) {
            String resolvedTable = resolveTableName(connection, table);
            return JdbcTableMetadataReader.readPrimaryKey(connection, effectiveSchema(connection), resolvedTable);
        } catch (SQLException exception) {
            throw new TargetAccessException(
                "Не удалось получить первичный ключ таблицы '" + table + "' в PostgreSQL", exception);
        }
    }

    public List<ForeignKeyMetadata> foreignKeys(String table) {
        try (Connection connection = targetDataSource.getConnection()) {
            String resolvedTable = resolveTableName(connection, table);
            return JdbcTableMetadataReader.readForeignKeys(connection, effectiveSchema(connection), resolvedTable);
        } catch (SQLException exception) {
            throw new TargetAccessException(
                "Не удалось получить внешние ключи таблицы '" + table + "' в PostgreSQL", exception);
        }
    }

    public List<CheckConstraintMetadata> checkConstraints(String table) {
        String sql = "SELECT c.conname, pg_get_constraintdef(c.oid) AS definition"
            + " FROM pg_constraint c"
            + " JOIN pg_class t ON t.oid = c.conrelid"
            + " JOIN pg_namespace n ON n.oid = t.relnamespace"
            + " WHERE c.contype = 'c' AND n.nspname = ? AND t.relname = ?"
            + " ORDER BY c.conname";

        try (Connection connection = targetDataSource.getConnection()) {
            String schema = effectiveSchema(connection);
            String resolvedTable = resolveTableName(connection, table);

            if (schema == null || schema.isBlank()) {
                return List.of();
            }

            List<CheckConstraintMetadata> constraints = new ArrayList<>();

            try (PreparedStatement statement = connection.prepareStatement(sql)) {
                statement.setString(1, schema);
                statement.setString(2, resolvedTable);

                try (ResultSet resultSet = statement.executeQuery()) {
                    while (resultSet.next()) {
                        constraints.add(new CheckConstraintMetadata(
                            resultSet.getString("conname"),
                            resultSet.getString("definition")));
                    }
                }
            }

            return constraints;
        } catch (SQLException exception) {
            throw new TargetAccessException(
                "Не удалось получить CHECK-constraints таблицы '" + table + "' в PostgreSQL", exception);
        }
    }

    /**
     * Проверяет, что Liquibase уже создал таблицу в PostgreSQL.
     */
    public void requireTable(String table) {
        String schema = properties.getSchema();
        String schemaFilter = schema == null || schema.isBlank() ? null : schema;

        try {
            Integer count = targetJdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.tables"
                    + " WHERE table_schema = COALESCE(?, current_schema()) AND table_name = ?",
                Integer.class, schemaFilter, table);

            if (count == null || count == 0) {
                throw new TargetAccessException("Таблица '" + table + "' отсутствует в PostgreSQL. "
                    + "Сначала запустите module-postgres, чтобы Liquibase создал схему.");
            }
        } catch (DataAccessException exception) {
            throw new TargetAccessException("Не удалось проверить наличие таблицы '" + table + "' в PostgreSQL", exception);
        }
    }

    /**
     * Проверяет наличие служебной таблицы соответствий source id → target id.
     */
    public void requireMappingTable() {
        requireTable(MAPPING_TABLE);
    }

    /**
     * Загружает все соответствия для указанного типа сущности.
     */
    public Map<Long, MigrationMapping> findMappings(MigrationEntity entity) {
        String sql = "SELECT source_id, target_id, source_key FROM " + qualifiedTable(MAPPING_TABLE)
            + " WHERE entity_type = ? ORDER BY source_id";

        try {
            return targetJdbcTemplate.query(sql, resultSet -> {
                Map<Long, MigrationMapping> mappings = new LinkedHashMap<>();

                while (resultSet.next()) {
                    mappings.put(
                        resultSet.getLong("source_id"),
                        new MigrationMapping(
                            resultSet.getLong("target_id"),
                            resultSet.getString("source_key")));
                }

                return mappings;
            }, entity.name());
        } catch (DataAccessException exception) {
            throw new TargetAccessException("Не удалось прочитать соответствия сущностей '" + entity + "'", exception);
        }
    }

    /**
     * Создаёт или обновляет соответствие исходной строки целевой.
     */
    public void upsertMapping(MigrationEntity entity, long sourceId, long targetId, String sourceKey) {
        String sql = "INSERT INTO " + qualifiedTable(MAPPING_TABLE)
            + " (entity_type, source_id, target_id, source_key, updated_at)"
            + " VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)"
            + " ON CONFLICT (entity_type, source_id) DO UPDATE"
            + " SET target_id = EXCLUDED.target_id, source_key = EXCLUDED.source_key,"
            + " updated_at = CURRENT_TIMESTAMP";

        try {
            targetJdbcTemplate.update(sql, entity.name(), sourceId, targetId, sourceKey);
        } catch (DataIntegrityViolationException exception) {
            throw new MigrationConflictException("Не удалось сохранить соответствие для сущности '"
                + entity + "' с source id=" + sourceId, exception);
        } catch (DataAccessException exception) {
            throw new TargetAccessException("Не удалось сохранить соответствие для сущности '"
                + entity + "' с source id=" + sourceId, exception);
        }
    }

    /**
     * Удаляет соответствие исходной строки.
     */
    public void deleteMapping(MigrationEntity entity, long sourceId) {
        String sql = "DELETE FROM " + qualifiedTable(MAPPING_TABLE)
            + " WHERE entity_type = ? AND source_id = ?";

        try {
            targetJdbcTemplate.update(sql, entity.name(), sourceId);
        } catch (DataAccessException exception) {
            throw new TargetAccessException("Не удалось удалить соответствие для сущности '"
                + entity + "' с source id=" + sourceId, exception);
        }
    }

    /**
     * Считает количество управляемых миграцией строк указанного типа.
     */
    public long countMappings(MigrationEntity entity) {
        String sql = "SELECT COUNT(*) FROM " + qualifiedTable(MAPPING_TABLE) + " WHERE entity_type = ?";

        try {
            Long count = targetJdbcTemplate.queryForObject(sql, Long.class, entity.name());
            return count == null ? 0 : count;
        } catch (DataAccessException exception) {
            throw new TargetAccessException("Не удалось посчитать соответствия сущностей '" + entity + "'", exception);
        }
    }

    /**
     * Загружает целевые id пользователей по их текущим username.
     */
    public Map<String, Long> findAllUserIdsByUsername() {
        String sql = "SELECT id, username FROM " + qualifiedTable(USERS_TABLE);

        try {
            return targetJdbcTemplate.query(sql, resultSet -> {
                Map<String, Long> idsByUsername = new LinkedHashMap<>();

                while (resultSet.next()) {
                    idsByUsername.put(resultSet.getString("username"), resultSet.getLong("id"));
                }

                return idsByUsername;
            });
        } catch (DataAccessException exception) {
            throw new TargetAccessException("Не удалось прочитать пользователей PostgreSQL", exception);
        }
    }

    /**
     * Загружает целевые id заказов по их текущим order_number.
     */
    public Map<String, Long> findAllOrderIdsByOrderNumber() {
        String sql = "SELECT id, order_number FROM " + qualifiedTable(ORDERS_TABLE);

        try {
            return targetJdbcTemplate.query(sql, resultSet -> {
                Map<String, Long> idsByOrderNumber = new LinkedHashMap<>();

                while (resultSet.next()) {
                    idsByOrderNumber.put(resultSet.getString("order_number"), resultSet.getLong("id"));
                }

                return idsByOrderNumber;
            });
        } catch (DataAccessException exception) {
            throw new TargetAccessException("Не удалось прочитать заказы PostgreSQL", exception);
        }
    }

    public long insertUser(String username, String email, LocalDateTime createdAt, LocalDateTime updatedAt) {
        try {
            Long id = targetJdbcTemplate.queryForObject(
                "INSERT INTO " + qualifiedTable(USERS_TABLE)
                    + " (username, email, created_at, updated_at) VALUES (?, ?, ?, ?) RETURNING id",
                Long.class, username, email, Timestamp.valueOf(createdAt), Timestamp.valueOf(updatedAt));

            return Objects.requireNonNull(id, "PostgreSQL не вернул идентификатор пользователя");
        } catch (DataIntegrityViolationException exception) {
            throw new MigrationConflictException("Пользователь '" + username + "' конфликтует с существующей "
                + "записью в PostgreSQL (уникальность username/email)", exception);
        } catch (DataAccessException exception) {
            throw new TargetAccessException("Не удалось вставить пользователя '" + username + "' в PostgreSQL", exception);
        }
    }

    /**
     * Обновляет пользователя по целевому id.
     *
     * @return {@code true}, если строка найдена и обновлена; {@code false}, если строки уже нет
     */
    public boolean updateUser(long id, String username, String email,
                              LocalDateTime createdAt, LocalDateTime updatedAt) {
        try {
            int updated = targetJdbcTemplate.update(
                "UPDATE " + qualifiedTable(USERS_TABLE)
                    + " SET username = ?, email = ?, created_at = ?, updated_at = ? WHERE id = ?",
                username, email, Timestamp.valueOf(createdAt), Timestamp.valueOf(updatedAt), id);

            return updated == 1;
        } catch (DataIntegrityViolationException exception) {
            throw new MigrationConflictException("Пользователь с целевым id=" + id + " конфликтует с существующей "
                + "записью в PostgreSQL (уникальность username/email)", exception);
        } catch (DataAccessException exception) {
            throw new TargetAccessException("Не удалось обновить пользователя id=" + id + " в PostgreSQL", exception);
        }
    }

    public long insertOrder(long userId, String orderNumber, BigDecimal amount, String status,
                            LocalDateTime createdAt) {
        try {
            Long id = targetJdbcTemplate.queryForObject(
                "INSERT INTO " + qualifiedTable(ORDERS_TABLE)
                    + " (user_id, order_number, amount, status, created_at) VALUES (?, ?, ?, ?, ?) RETURNING id",
                Long.class, userId, orderNumber, amount, status, Timestamp.valueOf(createdAt));

            return Objects.requireNonNull(id, "PostgreSQL не вернул идентификатор заказа");
        } catch (DataIntegrityViolationException exception) {
            throw new MigrationConflictException("Заказ '" + orderNumber + "' конфликтует с существующей "
                + "записью в PostgreSQL (уникальность номера, FK или статус)", exception);
        } catch (DataAccessException exception) {
            throw new TargetAccessException("Не удалось вставить заказ '" + orderNumber + "' в PostgreSQL", exception);
        }
    }

    /**
     * Обновляет заказ по целевому id.
     *
     * @return {@code true}, если строка найдена и обновлена; {@code false}, если строки уже нет
     */
    public boolean updateOrder(long id, long userId, String orderNumber, BigDecimal amount, String status,
                               LocalDateTime createdAt) {
        try {
            int updated = targetJdbcTemplate.update(
                "UPDATE " + qualifiedTable(ORDERS_TABLE)
                    + " SET user_id = ?, order_number = ?, amount = ?, status = ?, created_at = ? WHERE id = ?",
                userId, orderNumber, amount, status, Timestamp.valueOf(createdAt), id);

            return updated == 1;
        } catch (DataIntegrityViolationException exception) {
            throw new MigrationConflictException("Заказ с целевым id=" + id + " конфликтует с существующей "
                + "записью в PostgreSQL (уникальность номера, FK или статус)", exception);
        } catch (DataAccessException exception) {
            throw new TargetAccessException("Не удалось обновить заказ id=" + id + " в PostgreSQL", exception);
        }
    }

    /**
     * Удаляет пользователя по целевому id.
     *
     * @return {@code true}, если строка была удалена
     */
    public boolean deleteUser(long id) {
        try {
            return targetJdbcTemplate.update(
                "DELETE FROM " + qualifiedTable(USERS_TABLE) + " WHERE id = ?", id) == 1;
        } catch (DataIntegrityViolationException exception) {
            throw new MigrationConflictException("Нельзя удалить пользователя id=" + id
                + ": на него ссылаются заказы в PostgreSQL", exception);
        } catch (DataAccessException exception) {
            throw new TargetAccessException("Не удалось удалить пользователя id=" + id + " в PostgreSQL", exception);
        }
    }

    /**
     * Удаляет заказ по целевому id.
     *
     * @return {@code true}, если строка была удалена
     */
    public boolean deleteOrder(long id) {
        try {
            return targetJdbcTemplate.update(
                "DELETE FROM " + qualifiedTable(ORDERS_TABLE) + " WHERE id = ?", id) == 1;
        } catch (DataIntegrityViolationException exception) {
            throw new MigrationConflictException("Нельзя удалить заказ id=" + id
                + ": на него ссылаются дочерние записи в PostgreSQL", exception);
        } catch (DataAccessException exception) {
            throw new TargetAccessException("Не удалось удалить заказ id=" + id + " в PostgreSQL", exception);
        }
    }

    public long countUsers() {
        return count(USERS_TABLE);
    }

    public long countOrders() {
        return count(ORDERS_TABLE);
    }

    private long count(String table) {
        try {
            Long count = targetJdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM " + qualifiedTable(table), Long.class);

            return count == null ? 0 : count;
        } catch (DataAccessException exception) {
            throw new TargetAccessException("Не удалось посчитать строки таблицы '" + table + "' в PostgreSQL", exception);
        }
    }

    private List<String> readTableNames(Connection connection) throws SQLException {
        String schema = effectiveSchema(connection);
        List<String> tables = new ArrayList<>();

        try (ResultSet resultSet = connection.getMetaData()
            .getTables(null, schema, "%", new String[]{"TABLE"})) {
            while (resultSet.next()) {
                tables.add(resultSet.getString("TABLE_NAME"));
            }
        }

        tables.sort(String::compareTo);
        return tables;
    }

    private String resolveTableName(Connection connection, String table) throws SQLException {
        if (table == null || table.isBlank()) {
            throw new TargetAccessException("Не задано имя таблицы PostgreSQL");
        }

        String candidate = table.trim();

        return readTableNames(connection).stream()
            .filter(name -> name.equalsIgnoreCase(candidate))
            .findFirst()
            .orElseThrow(() -> new TargetAccessException(
                "Таблица '" + table + "' отсутствует в PostgreSQL"));
    }

    private String effectiveSchema(Connection connection) throws SQLException {
        String configured = properties.getSchema();

        if (configured != null && !configured.isBlank()) {
            return configured.trim();
        }

        String current = connection.getSchema();

        return current == null || current.isBlank() ? null : current;
    }

    private String qualifiedTable(String table) {
        String schema = properties.getSchema();

        if (schema == null || schema.isBlank()) {
            return quote(table);
        }

        return quote(schema) + "." + quote(table);
    }

    private String quote(String identifier) {
        return "\"" + identifier.replace("\"", "\"\"") + "\"";
    }
}

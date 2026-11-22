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
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import javax.sql.DataSource;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.dao.DataAccessException;
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
    private static final long MIGRATION_LOCK_KEY = 7_346_287_123_456_789L;

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
                    + "Создайте схему через Liquibase module-postgres "
                    + "или POST /api/v1/schema-migration/apply.");
            }
        } catch (DataAccessException exception) {
            throw new TargetAccessException("Не удалось проверить наличие таблицы '" + table + "' в PostgreSQL", exception);
        }
    }

    /**
     * Проверяет наличие служебной таблицы соответствий source id → target id
     * и колонки {@code last_seen_run}, без которой невозможен поиск stale-строк в БД.
     */
    public void requireMappingTable() {
        requireTable(MAPPING_TABLE);

        String schema = properties.getSchema();
        String schemaFilter = schema == null || schema.isBlank() ? null : schema;

        try {
            Integer count = targetJdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.columns"
                    + " WHERE table_schema = COALESCE(?, current_schema())"
                    + " AND table_name = ? AND column_name = 'last_seen_run'",
                Integer.class, schemaFilter, MAPPING_TABLE);

            if (count == null || count == 0) {
                throw new TargetAccessException("В таблице migration_entity_map отсутствует колонка last_seen_run. "
                    + "Примените Liquibase module-postgres или POST /api/v1/schema-migration/apply.");
            }
        } catch (DataAccessException exception) {
            throw new TargetAccessException("Не удалось проверить структуру migration_entity_map", exception);
        }
    }

    /**
     * Возвращает идентификатор текущего запуска.
     * <br>
     * Используется XID транзакции PostgreSQL: он уникален, не зависит от часов
     * и не требует отдельной sequence или полного скана карты соответствий.
     */
    public long currentRunId() {
        try {
            Long runId = targetJdbcTemplate.queryForObject("SELECT txid_current()", Long.class);

            if (runId == null) {
                throw new TargetAccessException("PostgreSQL не вернул идентификатор транзакции миграции");
            }

            return runId;
        } catch (DataAccessException exception) {
            throw new TargetAccessException("Не удалось получить идентификатор запуска миграции", exception);
        }
    }

    /**
     * Берёт транзакционную advisory-блокировку, чтобы два запуска миграции
     * не перетирали {@code last_seen_run} друг друга.
     */
    public void acquireRunLock() {
        try {
            Boolean locked = targetJdbcTemplate.queryForObject(
                "SELECT pg_try_advisory_xact_lock(?)", Boolean.class, MIGRATION_LOCK_KEY);

            if (!Boolean.TRUE.equals(locked)) {
                throw new MigrationConflictException("Уже выполняется другой запуск миграции");
            }
        } catch (DataAccessException exception) {
            throw new TargetAccessException("Не удалось получить блокировку запуска миграции", exception);
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

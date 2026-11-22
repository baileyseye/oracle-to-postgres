package baileyseyes.oracletopostgres.migration.source.oracle;

import baileyseyes.oracletopostgres.migration.common.exception.SourceAccessException;
import baileyseyes.oracletopostgres.migration.common.exception.TableNotFoundException;
import baileyseyes.oracletopostgres.migration.common.support.CheckConstraintMetadata;
import baileyseyes.oracletopostgres.migration.common.support.ColumnMetadata;
import baileyseyes.oracletopostgres.migration.common.support.ForeignKeyMetadata;
import baileyseyes.oracletopostgres.migration.common.support.IndexMetadata;
import baileyseyes.oracletopostgres.migration.common.support.JdbcTableMetadataReader;
import baileyseyes.oracletopostgres.migration.common.support.PrimaryKeyMetadata;
import baileyseyes.oracletopostgres.migration.source.config.MigrationSourceProperties;
import baileyseyes.oracletopostgres.migration.source.contract.MetadataProvider;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import javax.sql.DataSource;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;

/**
 * Поставщик метаданных Oracle-источника на основе JDBC {@link DatabaseMetaData}.
 * <br>
 * Перечень таблиц и колонок берётся исключительно из драйвера, поэтому поставщик не зависит
 * от того, какие именно объекты заведены в схеме.
 */
@Slf4j
@Component
public class OracleMetadataProvider implements MetadataProvider {

    private static final String TABLE_TYPE = "TABLE";

    private final DataSource dataSource;
    private final MigrationSourceProperties properties;

    public OracleMetadataProvider(@Qualifier("sourceDataSource") DataSource dataSource,
                                  MigrationSourceProperties properties) {
        this.dataSource = dataSource;
        this.properties = properties;
    }

    @Override
    public List<String> listTables() {
        try (Connection connection = dataSource.getConnection()) {
            return readTableNames(connection);
        } catch (SQLException exception) {
            throw new SourceAccessException("Не удалось получить список таблиц источника", exception);
        }
    }

    @Override
    public List<String> listColumns(String table) {
        try (Connection connection = dataSource.getConnection()) {
            String resolvedTable = resolveTableName(connection, table);
            return readColumnNames(connection, resolvedTable);
        } catch (SQLException exception) {
            throw new SourceAccessException("Не удалось получить колонки таблицы " + table, exception);
        }
    }

    @Override
    public List<IndexMetadata> listIndexes(String table) {
        try (Connection connection = dataSource.getConnection()) {
            String resolvedTable = resolveTableName(connection, table);
            return JdbcTableMetadataReader.readIndexes(connection, effectiveSchema(connection), resolvedTable);
        } catch (SQLException exception) {
            throw new SourceAccessException("Не удалось получить индексы таблицы " + table, exception);
        }
    }

    @Override
    public List<ColumnMetadata> listColumnMetadata(String table) {
        try (Connection connection = dataSource.getConnection()) {
            String resolvedTable = resolveTableName(connection, table);
            return JdbcTableMetadataReader.readColumns(connection, effectiveSchema(connection), resolvedTable);
        } catch (SQLException exception) {
            throw new SourceAccessException("Не удалось получить метаданные колонок таблицы " + table, exception);
        }
    }

    @Override
    public Optional<PrimaryKeyMetadata> primaryKey(String table) {
        try (Connection connection = dataSource.getConnection()) {
            String resolvedTable = resolveTableName(connection, table);
            return JdbcTableMetadataReader.readPrimaryKey(connection, effectiveSchema(connection), resolvedTable);
        } catch (SQLException exception) {
            throw new SourceAccessException("Не удалось получить первичный ключ таблицы " + table, exception);
        }
    }

    @Override
    public List<ForeignKeyMetadata> foreignKeys(String table) {
        try (Connection connection = dataSource.getConnection()) {
            String schema = effectiveSchema(connection);
            String resolvedTable = resolveTableName(connection, table);
            Map<String, String> deleteRules = readDeleteRules(connection, schema, resolvedTable);

            return JdbcTableMetadataReader.readForeignKeys(connection, schema, resolvedTable).stream()
                .map(key -> new ForeignKeyMetadata(
                    key.name(),
                    key.columns(),
                    key.referencedTable(),
                    key.referencedColumns(),
                    "NO ACTION",
                    deleteRules.getOrDefault(key.name(), key.deleteRule())))
                .toList();
        } catch (SQLException exception) {
            throw new SourceAccessException("Не удалось получить внешние ключи таблицы " + table, exception);
        }
    }

    private Map<String, String> readDeleteRules(Connection connection, String schema, String table)
        throws SQLException {
        if (schema == null || schema.isBlank()) {
            return Map.of();
        }

        String sql = "SELECT CONSTRAINT_NAME, DELETE_RULE FROM ALL_CONSTRAINTS"
            + " WHERE OWNER = ? AND TABLE_NAME = ? AND CONSTRAINT_TYPE = 'R'";
        Map<String, String> rules = new LinkedHashMap<>();

        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, schema);
            statement.setString(2, table);

            try (ResultSet resultSet = statement.executeQuery()) {
                while (resultSet.next()) {
                    rules.put(
                        resultSet.getString("CONSTRAINT_NAME"),
                        resultSet.getString("DELETE_RULE"));
                }
            }
        }

        return rules;
    }

    @Override
    public List<CheckConstraintMetadata> checkConstraints(String table) {
        String sql = "SELECT CONSTRAINT_NAME, SEARCH_CONDITION_VC FROM ALL_CONSTRAINTS"
            + " WHERE OWNER = ? AND TABLE_NAME = ? AND CONSTRAINT_TYPE = 'C'"
            + " AND SEARCH_CONDITION_VC IS NOT NULL ORDER BY CONSTRAINT_NAME";

        try (Connection connection = dataSource.getConnection()) {
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
                            resultSet.getString("CONSTRAINT_NAME"),
                            resultSet.getString("SEARCH_CONDITION_VC")));
                    }
                }
            }

            return constraints;
        } catch (SQLException exception) {
            throw new SourceAccessException("Не удалось получить CHECK-constraints таблицы " + table, exception);
        }
    }

    @Override
    public String qualifiedTableName(String table) {
        try (Connection connection = dataSource.getConnection()) {
            String resolvedTable = resolveTableName(connection, table);
            return qualify(effectiveSchema(connection), resolvedTable);
        } catch (SQLException exception) {
            throw new SourceAccessException("Не удалось подготовить имя таблицы " + table, exception);
        }
    }

    private List<String> readTableNames(Connection connection) throws SQLException {
        String schema = effectiveSchema(connection);
        List<String> tables = new ArrayList<>();

        DatabaseMetaData metaData = connection.getMetaData();

        try (ResultSet resultSet = metaData.getTables(null, schema, "%", new String[]{TABLE_TYPE})) {
            while (resultSet.next()) {
                String tableName = resultSet.getString("TABLE_NAME");
                if (!isExcluded(tableName)) {
                    tables.add(tableName);
                }
            }
        }

        tables.sort(String::compareTo);
        log.debug("Получен список таблиц схемы {}: {}", schema, tables);

        return tables;
    }

    private List<String> readColumnNames(Connection connection, String table) throws SQLException {
        String schema = effectiveSchema(connection);
        List<String> columns = new ArrayList<>();

        DatabaseMetaData metaData = connection.getMetaData();

        try (ResultSet resultSet = metaData.getColumns(null, schema, table, "%")) {
            while (resultSet.next()) {
                columns.add(resultSet.getString("COLUMN_NAME"));
            }
        }

        log.debug("Получены колонки таблицы {}: {}", table, columns);
        return columns;
    }

    /**
     * Сверяет запрошенное имя с фактическим перечнем таблиц и возвращает каноническое имя СУБД.
     */
    private String resolveTableName(Connection connection, String table) throws SQLException {
        if (table == null || table.isBlank()) {
            throw new TableNotFoundException(String.valueOf(table));
        }

        String candidate = table.trim();

        return readTableNames(connection).stream()
            .filter(name -> name.equalsIgnoreCase(candidate))
            .findFirst()
            .orElseThrow(() -> new TableNotFoundException(table));
    }

    private boolean isExcluded(String tableName) {
        List<String> excluded = properties.getExcludedTables();

        return excluded != null && excluded.stream()
            .filter(name -> name != null && !name.isBlank())
            .map(String::trim)
            .anyMatch(pattern -> matches(pattern, tableName));
    }

    /**
     * Поддерживает точное имя и шаблон с {@code *} в конце, например {@code AQ$_*}.
     */
    private boolean matches(String pattern, String tableName) {
        if (pattern.endsWith("*")) {
            String prefix = pattern.substring(0, pattern.length() - 1);
            return tableName.regionMatches(true, 0, prefix, 0, prefix.length());
        }

        return tableName.equalsIgnoreCase(pattern);
    }

    private String qualify(String schema, String table) {
        if (schema == null || schema.isBlank()) {
            return quote(table);
        }

        return quote(schema) + "." + quote(table);
    }

    private String quote(String identifier) {
        return "\"" + identifier.replace("\"", "\"\"") + "\"";
    }

    /**
     * Явно заданная схема имеет приоритет; иначе используется схема текущего подключения,
     * чтобы в перечень не попали системные объекты СУБД.
     */
    private String effectiveSchema(Connection connection) throws SQLException {
        String configured = properties.getSchema();

        if (configured != null && !configured.isBlank()) {
            return configured.trim().toUpperCase(Locale.ROOT);
        }

        String current = connection.getSchema();

        if (current == null || current.isBlank()) {
            return null;
        }

        return current.toUpperCase(Locale.ROOT);
    }
}

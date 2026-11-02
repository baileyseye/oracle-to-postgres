package baileyseyes.oracletopostgres.migration.source.oracle;

import baileyseyes.oracletopostgres.migration.common.exception.SourceAccessException;
import baileyseyes.oracletopostgres.migration.common.exception.TableNotFoundException;
import baileyseyes.oracletopostgres.migration.source.config.MigrationSourceProperties;
import baileyseyes.oracletopostgres.migration.source.contract.MetadataProvider;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import javax.sql.DataSource;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * Поставщик метаданных Oracle-источника на основе JDBC {@link DatabaseMetaData}.
 * <br>
 * Перечень таблиц и колонок берётся исключительно из драйвера, поэтому поставщик не зависит
 * от того, какие именно объекты заведены в схеме.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OracleMetadataProvider implements MetadataProvider {

    private static final String TABLE_TYPE = "TABLE";

    private final DataSource dataSource;
    private final MigrationSourceProperties properties;

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
    public String resolveTableName(String table) {
        try (Connection connection = dataSource.getConnection()) {
            return resolveTableName(connection, table);
        } catch (SQLException exception) {
            throw new SourceAccessException("Не удалось проверить наличие таблицы " + table, exception);
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
            .anyMatch(name -> name.equalsIgnoreCase(tableName));
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

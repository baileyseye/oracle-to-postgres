package baileyseyes.oracletopostgres.migration.common.support;

import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;

/**
 * Чтение структуры таблицы через JDBC {@link DatabaseMetaData}.
 * <br>
 * Используется и для Oracle, и для PostgreSQL; различия диалектов инкапсулированы
 * в самих JDBC-драйверах. Имена constraints не сравниваются, только их состав.
 */
public final class JdbcTableMetadataReader {

    private JdbcTableMetadataReader() {
    }

    public static List<ColumnMetadata> readColumns(Connection connection, String schema, String table)
        throws SQLException {
        List<ColumnMetadata> columns = new ArrayList<>();
        DatabaseMetaData metaData = connection.getMetaData();

        try (ResultSet resultSet = metaData.getColumns(null, schema, table, "%")) {
            while (resultSet.next()) {
                columns.add(new ColumnMetadata(
                    resultSet.getString("COLUMN_NAME"),
                    resultSet.getString("TYPE_NAME"),
                    resultSet.getInt("DATA_TYPE"),
                    resultSet.getInt("COLUMN_SIZE"),
                    resultSet.getInt("DECIMAL_DIGITS"),
                    resultSet.getInt("NULLABLE") != DatabaseMetaData.columnNoNulls,
                    resultSet.getString("COLUMN_DEF"),
                    "YES".equalsIgnoreCase(resultSet.getString("IS_AUTOINCREMENT"))));
            }
        }

        return columns;
    }

    public static Optional<PrimaryKeyMetadata> readPrimaryKey(Connection connection, String schema, String table)
        throws SQLException {
        Map<Integer, String> columns = new TreeMap<>();
        String name = null;
        DatabaseMetaData metaData = connection.getMetaData();

        try (ResultSet resultSet = metaData.getPrimaryKeys(null, schema, table)) {
            while (resultSet.next()) {
                name = resultSet.getString("PK_NAME");
                columns.put(resultSet.getInt("KEY_SEQ"), resultSet.getString("COLUMN_NAME"));
            }
        }

        if (columns.isEmpty()) {
            return Optional.empty();
        }

        return Optional.of(new PrimaryKeyMetadata(name, List.copyOf(columns.values())));
    }

    public static List<ForeignKeyMetadata> readForeignKeys(Connection connection, String schema, String table)
        throws SQLException {
        Map<String, ForeignKeyAccumulator> foreignKeys = new LinkedHashMap<>();
        DatabaseMetaData metaData = connection.getMetaData();

        try (ResultSet resultSet = metaData.getImportedKeys(null, schema, table)) {
            while (resultSet.next()) {
                String name = resultSet.getString("FK_NAME");
                String referencedTable = resultSet.getString("PKTABLE_NAME");
                String key = name == null ? referencedTable + "#" + resultSet.getRow() : name;

                ForeignKeyAccumulator accumulator = foreignKeys.computeIfAbsent(
                    key,
                    ignored -> new ForeignKeyAccumulator(
                        name,
                        referencedTable,
                        ruleName(resultSetShort(resultSet, "UPDATE_RULE")),
                        ruleName(resultSetShort(resultSet, "DELETE_RULE"))));

                int position = resultSet.getInt("KEY_SEQ");
                accumulator.columns.put(position, resultSet.getString("FKCOLUMN_NAME"));
                accumulator.referencedColumns.put(position, resultSet.getString("PKCOLUMN_NAME"));
            }
        }

        return foreignKeys.values().stream()
            .map(accumulator -> new ForeignKeyMetadata(
                accumulator.name,
                List.copyOf(accumulator.columns.values()),
                accumulator.referencedTable,
                List.copyOf(accumulator.referencedColumns.values()),
                accumulator.updateRule,
                accumulator.deleteRule))
            .toList();
    }

    public static List<IndexMetadata> readIndexes(Connection connection, String schema, String table)
        throws SQLException {
        return IndexMetadataReader.read(connection, schema, table);
    }

    private static short resultSetShort(ResultSet resultSet, String column) {
        try {
            return resultSet.getShort(column);
        } catch (SQLException exception) {
            return DatabaseMetaData.importedKeyNoAction;
        }
    }

    private static String ruleName(short rule) {
        return switch (rule) {
            case DatabaseMetaData.importedKeyCascade -> "CASCADE";
            case DatabaseMetaData.importedKeySetNull -> "SET NULL";
            case DatabaseMetaData.importedKeySetDefault -> "SET DEFAULT";
            case DatabaseMetaData.importedKeyRestrict -> "RESTRICT";
            case DatabaseMetaData.importedKeyNoAction -> "NO ACTION";
            default -> "UNKNOWN";
        };
    }

    private static final class ForeignKeyAccumulator {

        private final String name;
        private final String referencedTable;
        private final String updateRule;
        private final String deleteRule;
        private final Map<Integer, String> columns = new TreeMap<>();
        private final Map<Integer, String> referencedColumns = new TreeMap<>();

        private ForeignKeyAccumulator(String name, String referencedTable,
                                      String updateRule, String deleteRule) {
            this.name = name;
            this.referencedTable = referencedTable;
            this.updateRule = updateRule;
            this.deleteRule = deleteRule;
        }
    }
}

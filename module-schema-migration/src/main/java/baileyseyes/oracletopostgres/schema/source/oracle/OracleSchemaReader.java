package baileyseyes.oracletopostgres.schema.source.oracle;

import baileyseyes.oracletopostgres.schema.common.exception.SourceAccessException;
import baileyseyes.oracletopostgres.schema.model.OracleCheck;
import baileyseyes.oracletopostgres.schema.model.OracleColumn;
import baileyseyes.oracletopostgres.schema.model.OracleForeignKey;
import baileyseyes.oracletopostgres.schema.model.OracleIndex;
import baileyseyes.oracletopostgres.schema.model.OracleSchema;
import baileyseyes.oracletopostgres.schema.model.OracleSequence;
import baileyseyes.oracletopostgres.schema.model.OracleTable;
import baileyseyes.oracletopostgres.schema.model.UnsupportedObject;
import baileyseyes.oracletopostgres.schema.source.config.SchemaSourceProperties;
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
import java.util.TreeMap;
import javax.sql.DataSource;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;

/**
 * Чтение Oracle-схемы через JDBC и словари Oracle.
 * <br>
 * Читаются таблицы, колонки, PK/FK, индексы, CHECK-constraints, комментарии,
 * последовательности и перечень объектов, которые не переносятся автоматически.
 */
@Slf4j
@Component
public class OracleSchemaReader {

    private final DataSource dataSource;
    private final SchemaSourceProperties properties;

    public OracleSchemaReader(@Qualifier("schemaSourceDataSource") DataSource dataSource,
                              SchemaSourceProperties properties) {
        this.dataSource = dataSource;
        this.properties = properties;
    }

    public OracleSchema readSchema() {
        try (Connection connection = dataSource.getConnection()) {
            String schema = effectiveSchema(connection);
            List<OracleTable> tables = readTables(connection, schema);
            List<OracleSequence> sequences = readSequences(connection, schema);
            List<UnsupportedObject> unsupported = readUnsupportedObjects(connection, schema);

            log.info("Прочитана Oracle-схема {}: таблиц={}, sequences={}, unsupported={}",
                schema, tables.size(), sequences.size(), unsupported.size());

            return new OracleSchema(schema, tables, sequences, unsupported);
        } catch (SQLException exception) {
            throw new SourceAccessException("Не удалось прочитать Oracle-схему", exception);
        }
    }

    private List<OracleTable> readTables(Connection connection, String schema) throws SQLException {
        List<String> tableNames = new ArrayList<>();
        DatabaseMetaData metaData = connection.getMetaData();

        try (ResultSet resultSet = metaData.getTables(null, schema, "%", new String[]{"TABLE"})) {
            while (resultSet.next()) {
                String tableName = resultSet.getString("TABLE_NAME");

                if (!isExcluded(tableName)) {
                    tableNames.add(tableName);
                }
            }
        }

        tableNames.sort(String::compareTo);
        List<OracleTable> tables = new ArrayList<>();

        for (String tableName : tableNames) {
            tables.add(readTable(connection, schema, tableName));
        }

        return tables;
    }

    private OracleTable readTable(Connection connection, String schema, String tableName)
        throws SQLException {
        Map<String, String> deleteRules = readDeleteRules(connection, schema, tableName);

        return new OracleTable(
            tableName,
            readColumns(connection, schema, tableName),
            readPrimaryKey(connection, schema, tableName),
            readIndexes(connection, schema, tableName),
            readForeignKeys(connection, schema, tableName, deleteRules),
            readChecks(connection, schema, tableName),
            readTableComment(connection, schema, tableName),
            readColumnComments(connection, schema, tableName));
    }

    private List<OracleColumn> readColumns(Connection connection, String schema, String table)
        throws SQLException {
        List<OracleColumn> columns = new ArrayList<>();

        try (ResultSet resultSet = connection.getMetaData().getColumns(null, schema, table, "%")) {
            while (resultSet.next()) {
                columns.add(new OracleColumn(
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

    private List<String> readPrimaryKey(Connection connection, String schema, String table)
        throws SQLException {
        Map<Integer, String> columns = new TreeMap<>();

        try (ResultSet resultSet = connection.getMetaData().getPrimaryKeys(null, schema, table)) {
            while (resultSet.next()) {
                columns.put(resultSet.getInt("KEY_SEQ"), resultSet.getString("COLUMN_NAME"));
            }
        }

        return List.copyOf(columns.values());
    }

    private List<OracleIndex> readIndexes(Connection connection, String schema, String table)
        throws SQLException {
        Map<String, IndexAccumulator> indexes = new LinkedHashMap<>();

        try (ResultSet resultSet = connection.getMetaData().getIndexInfo(null, schema, table, false, false)) {
            while (resultSet.next()) {
                if (resultSet.getShort("TYPE") == DatabaseMetaData.tableIndexStatistic) {
                    continue;
                }

                String indexName = resultSet.getString("INDEX_NAME");
                String columnName = resultSet.getString("COLUMN_NAME");

                if (indexName == null || columnName == null) {
                    continue;
                }

                indexes.computeIfAbsent(
                    indexName,
                    name -> new IndexAccumulator(!resultSetBoolean(resultSet, "NON_UNIQUE")))
                    .columns.put(resultSet.getInt("ORDINAL_POSITION"), columnName);
            }
        }

        return indexes.entrySet().stream()
            .map(entry -> new OracleIndex(
                entry.getKey(),
                entry.getValue().unique,
                List.copyOf(entry.getValue().columns.values())))
            .toList();
    }

    private List<OracleForeignKey> readForeignKeys(Connection connection, String schema, String table,
                                                   Map<String, String> deleteRules) throws SQLException {
        Map<String, ForeignKeyAccumulator> keys = new LinkedHashMap<>();

        try (ResultSet resultSet = connection.getMetaData().getImportedKeys(null, schema, table)) {
            while (resultSet.next()) {
                String name = resultSet.getString("FK_NAME");
                String referencedTable = resultSet.getString("PKTABLE_NAME");
                String key = name == null ? referencedTable + "#" + resultSet.getRow() : name;
                ForeignKeyAccumulator accumulator = keys.computeIfAbsent(
                    key,
                    ignored -> new ForeignKeyAccumulator(name, referencedTable));

                int position = resultSet.getInt("KEY_SEQ");
                accumulator.columns.put(position, resultSet.getString("FKCOLUMN_NAME"));
                accumulator.referencedColumns.put(position, resultSet.getString("PKCOLUMN_NAME"));
            }
        }

        return keys.values().stream()
            .map(accumulator -> new OracleForeignKey(
                accumulator.name,
                List.copyOf(accumulator.columns.values()),
                accumulator.referencedTable,
                List.copyOf(accumulator.referencedColumns.values()),
                "NO ACTION",
                deleteRules.getOrDefault(accumulator.name, "NO ACTION")))
            .toList();
    }

    private Map<String, String> readDeleteRules(Connection connection, String schema, String table)
        throws SQLException {
        String sql = "SELECT CONSTRAINT_NAME, DELETE_RULE FROM ALL_CONSTRAINTS"
            + " WHERE OWNER = ? AND TABLE_NAME = ? AND CONSTRAINT_TYPE = 'R'";
        Map<String, String> rules = new LinkedHashMap<>();

        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, schema);
            statement.setString(2, table);

            try (ResultSet resultSet = statement.executeQuery()) {
                while (resultSet.next()) {
                    rules.put(resultSet.getString("CONSTRAINT_NAME"), resultSet.getString("DELETE_RULE"));
                }
            }
        }

        return rules;
    }

    private List<OracleCheck> readChecks(Connection connection, String schema, String table)
        throws SQLException {
        String sql = "SELECT CONSTRAINT_NAME, SEARCH_CONDITION_VC FROM ALL_CONSTRAINTS"
            + " WHERE OWNER = ? AND TABLE_NAME = ? AND CONSTRAINT_TYPE = 'C'"
            + " AND SEARCH_CONDITION_VC IS NOT NULL ORDER BY CONSTRAINT_NAME";
        List<OracleCheck> checks = new ArrayList<>();

        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, schema);
            statement.setString(2, table);

            try (ResultSet resultSet = statement.executeQuery()) {
                while (resultSet.next()) {
                    checks.add(new OracleCheck(
                        resultSet.getString("CONSTRAINT_NAME"),
                        resultSet.getString("SEARCH_CONDITION_VC")));
                }
            }
        }

        return checks;
    }

    private String readTableComment(Connection connection, String schema, String table)
        throws SQLException {
        String sql = "SELECT COMMENTS FROM ALL_TAB_COMMENTS WHERE OWNER = ? AND TABLE_NAME = ?";

        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, schema);
            statement.setString(2, table);

            try (ResultSet resultSet = statement.executeQuery()) {
                return resultSet.next() ? resultSet.getString("COMMENTS") : null;
            }
        }
    }

    private Map<String, String> readColumnComments(Connection connection, String schema, String table)
        throws SQLException {
        String sql = "SELECT COLUMN_NAME, COMMENTS FROM ALL_COL_COMMENTS"
            + " WHERE OWNER = ? AND TABLE_NAME = ? AND COMMENTS IS NOT NULL";
        Map<String, String> comments = new LinkedHashMap<>();

        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, schema);
            statement.setString(2, table);

            try (ResultSet resultSet = statement.executeQuery()) {
                while (resultSet.next()) {
                    comments.put(resultSet.getString("COLUMN_NAME"), resultSet.getString("COMMENTS"));
                }
            }
        }

        return comments;
    }

    private List<OracleSequence> readSequences(Connection connection, String schema)
        throws SQLException {
        String sql = "SELECT SEQUENCE_NAME, LAST_NUMBER, INCREMENT_BY FROM ALL_SEQUENCES"
            + " WHERE SEQUENCE_OWNER = ? AND SEQUENCE_NAME NOT LIKE 'ISEQ$$%' ORDER BY SEQUENCE_NAME";
        List<OracleSequence> sequences = new ArrayList<>();

        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, schema);

            try (ResultSet resultSet = statement.executeQuery()) {
                while (resultSet.next()) {
                    String sequenceName = resultSet.getString("SEQUENCE_NAME");

                    if (isExcluded(sequenceName)) {
                        continue;
                    }

                    sequences.add(new OracleSequence(
                        sequenceName,
                        resultSet.getLong("LAST_NUMBER"),
                        resultSet.getLong("INCREMENT_BY")));
                }
            }
        }

        return sequences;
    }

    private List<UnsupportedObject> readUnsupportedObjects(Connection connection, String schema)
        throws SQLException {
        List<UnsupportedObject> objects = new ArrayList<>();
        addUnsupported(objects, "VIEW", count(connection,
            "SELECT COUNT(*) FROM ALL_VIEWS WHERE OWNER = ?", schema));
        addUnsupported(objects, "TRIGGER", count(connection,
            "SELECT COUNT(*) FROM ALL_TRIGGERS WHERE OWNER = ?", schema));
        addUnsupported(objects, "PLSQL", count(connection,
            "SELECT COUNT(*) FROM ALL_OBJECTS WHERE OWNER = ?"
                + " AND OBJECT_TYPE IN ('PROCEDURE','FUNCTION','PACKAGE','PACKAGE BODY','TYPE','TYPE BODY')",
            schema));
        addUnsupported(objects, "SYNONYM", count(connection,
            "SELECT COUNT(*) FROM ALL_SYNONYMS WHERE OWNER = ? OR TABLE_OWNER = ?", schema, schema));
        addUnsupported(objects, "PARTITIONED_TABLE", count(connection,
            "SELECT COUNT(*) FROM ALL_PART_TABLES WHERE OWNER = ?", schema));
        addUnsupported(objects, "TABLE_GRANT", count(connection,
            "SELECT COUNT(*) FROM ALL_TAB_PRIVS WHERE TABLE_SCHEMA = ?", schema));
        return objects;
    }

    private long count(Connection connection, String sql, String... parameters) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            for (int index = 0; index < parameters.length; index++) {
                statement.setString(index + 1, parameters[index]);
            }

            try (ResultSet resultSet = statement.executeQuery()) {
                return resultSet.next() ? resultSet.getLong(1) : 0;
            }
        }
    }

    private void addUnsupported(List<UnsupportedObject> objects, String type, long count) {
        if (count > 0) {
            objects.add(new UnsupportedObject(type, (int) count));
        }
    }

    private boolean isExcluded(String tableName) {
        List<String> excluded = properties.getExcludedTables();

        return excluded != null && excluded.stream()
            .filter(name -> name != null && !name.isBlank())
            .map(String::trim)
            .anyMatch(pattern -> matches(pattern, tableName));
    }

    private boolean matches(String pattern, String tableName) {
        if (pattern.endsWith("*")) {
            String prefix = pattern.substring(0, pattern.length() - 1);
            return tableName.regionMatches(true, 0, prefix, 0, prefix.length());
        }

        return tableName.equalsIgnoreCase(pattern);
    }

    private boolean resultSetBoolean(ResultSet resultSet, String column) {
        try {
            return resultSet.getBoolean(column);
        } catch (SQLException exception) {
            return false;
        }
    }

    private String effectiveSchema(Connection connection) throws SQLException {
        String configured = properties.getSchema();

        if (configured != null && !configured.isBlank()) {
            return configured.trim().toUpperCase(Locale.ROOT);
        }

        String current = connection.getSchema();

        if (current == null || current.isBlank()) {
            throw new SourceAccessException("Не удалось определить схему Oracle", null);
        }

        return current.toUpperCase(Locale.ROOT);
    }

    private static final class IndexAccumulator {

        private final boolean unique;
        private final Map<Integer, String> columns = new TreeMap<>();

        private IndexAccumulator(boolean unique) {
            this.unique = unique;
        }
    }

    private static final class ForeignKeyAccumulator {

        private final String name;
        private final String referencedTable;
        private final Map<Integer, String> columns = new TreeMap<>();
        private final Map<Integer, String> referencedColumns = new TreeMap<>();

        private ForeignKeyAccumulator(String name, String referencedTable) {
            this.name = name;
            this.referencedTable = referencedTable;
        }
    }
}

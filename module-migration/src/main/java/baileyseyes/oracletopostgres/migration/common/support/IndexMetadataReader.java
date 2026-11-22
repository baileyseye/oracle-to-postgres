package baileyseyes.oracletopostgres.migration.common.support;

import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * Чтение индексов через JDBC {@link DatabaseMetaData}.
 * <br>
 * Сравнение идёт по составу колонок и уникальности, потому что имена индексов
 * в Oracle и PostgreSQL не совпадают.
 */
public final class IndexMetadataReader {

    private IndexMetadataReader() {
    }

    public static List<IndexMetadata> read(Connection connection, String schema, String table)
        throws SQLException {
        Map<String, IndexAccumulator> indexes = new LinkedHashMap<>();
        DatabaseMetaData metaData = connection.getMetaData();

        try (ResultSet resultSet = metaData.getIndexInfo(null, schema, table, false, false)) {
            while (resultSet.next()) {
                if (resultSet.getShort("TYPE") == DatabaseMetaData.tableIndexStatistic) {
                    continue;
                }

                String indexName = resultSet.getString("INDEX_NAME");
                String columnName = resultSet.getString("COLUMN_NAME");

                if (indexName == null || columnName == null) {
                    continue;
                }

                boolean unique = !resultSet.getBoolean("NON_UNIQUE");
                int position = resultSet.getInt("ORDINAL_POSITION");

                indexes.computeIfAbsent(indexName, name -> new IndexAccumulator(unique))
                    .columns.put(position, columnName);
            }
        }

        return indexes.values().stream()
            .map(accumulator -> new IndexMetadata(
                accumulator.unique,
                List.copyOf(accumulator.columns.values())))
            .toList();
    }

    private static final class IndexAccumulator {

        private final boolean unique;
        private final Map<Integer, String> columns = new TreeMap<>();

        private IndexAccumulator(boolean unique) {
            this.unique = unique;
        }
    }
}

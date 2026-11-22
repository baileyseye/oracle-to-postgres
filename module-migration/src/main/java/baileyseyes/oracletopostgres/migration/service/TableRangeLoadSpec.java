package baileyseyes.oracletopostgres.migration.service;

import java.util.List;
import java.util.Map;

/**
 * Описание одной таблицы для parallel range-загрузки.
 */
public record TableRangeLoadSpec(String sourceTable,
                                 String targetTable,
                                 String sourceKeyColumn,
                                 String targetKeyColumn,
                                 List<String> sourceColumns,
                                 int chunkSize,
                                 RangeResume resume,
                                 ChunkWriter writer) {

    public TableRangeLoadSpec {
        sourceColumns = List.copyOf(sourceColumns);
    }

    @FunctionalInterface
    public interface ChunkWriter {
        long write(List<Map<String, Object>> rows);
    }

    @FunctionalInterface
    public interface RangeResume {
        long maxKeyBetween(String targetTable, String targetKeyColumn, long from, long to);
    }
}

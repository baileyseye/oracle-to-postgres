package baileyseyes.oracletopostgres.migration.service.plan;

import java.util.List;

/**
 * План загрузки одной таблицы в initial-load.
 */
public record InitialLoadTablePlan(String sourceTable,
                                   String targetTable,
                                   List<TableColumnPlan> columns,
                                   String sourceKeyColumn,
                                   String targetKeyColumn,
                                   boolean keyset,
                                   boolean hasLobs) {

    public InitialLoadTablePlan {
        columns = List.copyOf(columns);
    }
}

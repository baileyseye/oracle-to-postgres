package baileyseyes.oracletopostgres.migration.common.support;

import java.util.List;

public record ForeignKeyMetadata(
    String name,
    List<String> columns,
    String referencedTable,
    List<String> referencedColumns,
    String updateRule,
    String deleteRule
) {

    public ForeignKeyMetadata {
        columns = List.copyOf(columns);
        referencedColumns = List.copyOf(referencedColumns);
    }
}

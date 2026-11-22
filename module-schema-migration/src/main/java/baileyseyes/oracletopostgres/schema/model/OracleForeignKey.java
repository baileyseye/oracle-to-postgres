package baileyseyes.oracletopostgres.schema.model;

import java.util.List;

public record OracleForeignKey(
    String name,
    List<String> columns,
    String referencedTable,
    List<String> referencedColumns,
    String updateRule,
    String deleteRule
) {

    public OracleForeignKey {
        columns = List.copyOf(columns);
        referencedColumns = List.copyOf(referencedColumns);
    }
}

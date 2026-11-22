package baileyseyes.oracletopostgres.schema.model;

import java.util.List;
import java.util.Map;

public record OracleTable(
    String name,
    List<OracleColumn> columns,
    List<String> primaryKey,
    List<OracleIndex> indexes,
    List<OracleForeignKey> foreignKeys,
    List<OracleCheck> checks,
    String comment,
    Map<String, String> columnComments
) {

    public OracleTable {
        columns = List.copyOf(columns);
        primaryKey = List.copyOf(primaryKey);
        indexes = List.copyOf(indexes);
        foreignKeys = List.copyOf(foreignKeys);
        checks = List.copyOf(checks);
        columnComments = Map.copyOf(columnComments);
    }
}

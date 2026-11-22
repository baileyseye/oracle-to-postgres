package baileyseyes.oracletopostgres.schema.target.service;

import java.util.Map;
import java.util.Set;

public record PostgresTargetSnapshot(String schema, Set<String> tables, Map<String, Set<String>> columns) {

    public PostgresTargetSnapshot {
        tables = Set.copyOf(tables);
        columns = Map.copyOf(columns);
    }
}

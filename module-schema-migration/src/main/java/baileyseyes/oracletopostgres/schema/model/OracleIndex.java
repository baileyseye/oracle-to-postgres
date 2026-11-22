package baileyseyes.oracletopostgres.schema.model;

import java.util.List;

public record OracleIndex(String name, boolean unique, List<String> columns) {

    public OracleIndex {
        columns = List.copyOf(columns);
    }
}

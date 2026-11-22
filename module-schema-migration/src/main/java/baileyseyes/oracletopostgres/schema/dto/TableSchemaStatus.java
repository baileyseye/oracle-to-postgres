package baileyseyes.oracletopostgres.schema.dto;

import java.util.List;

public record TableSchemaStatus(String table, boolean presentInTarget, List<String> missingColumns) {

    public TableSchemaStatus {
        missingColumns = List.copyOf(missingColumns);
    }
}

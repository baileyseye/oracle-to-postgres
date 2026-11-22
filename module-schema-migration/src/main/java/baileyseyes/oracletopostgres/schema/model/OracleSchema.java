package baileyseyes.oracletopostgres.schema.model;

import java.util.List;

public record OracleSchema(
    String schema,
    List<OracleTable> tables,
    List<OracleSequence> sequences,
    List<UnsupportedObject> unsupportedObjects
) {

    public OracleSchema {
        tables = List.copyOf(tables);
        sequences = List.copyOf(sequences);
        unsupportedObjects = List.copyOf(unsupportedObjects);
    }
}

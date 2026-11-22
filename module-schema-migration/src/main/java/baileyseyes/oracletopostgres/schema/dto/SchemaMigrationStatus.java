package baileyseyes.oracletopostgres.schema.dto;

import static lombok.AccessLevel.PRIVATE;

import baileyseyes.oracletopostgres.schema.model.UnsupportedObject;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = PRIVATE)
public class SchemaMigrationStatus {

    String sourceSchema;
    String targetSchema;
    boolean targetExists;
    int sourceTables;
    int targetTables;
    int missingTables;
    int missingColumns;
    boolean valid;
    List<TableSchemaStatus> tables;
    List<UnsupportedObject> unsupportedObjects;
}

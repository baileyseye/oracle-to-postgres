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
public class SchemaMigrationPlan {

    String sourceSchema;
    String targetSchema;
    boolean targetEmpty;
    int tables;
    int statements;
    List<SchemaDdlStatement> ddl;
    List<String> warnings;
    List<UnsupportedObject> unsupportedObjects;
}

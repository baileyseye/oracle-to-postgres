package baileyseyes.oracletopostgres.schema.dto;

import static lombok.AccessLevel.PRIVATE;

import java.time.LocalDateTime;
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
public class SchemaMigrationReport {

    String sourceSchema;
    String targetSchema;
    LocalDateTime startedAt;
    LocalDateTime finishedAt;
    int appliedStatements;
    int totalStatements;
    boolean success;
    List<String> warnings;
}

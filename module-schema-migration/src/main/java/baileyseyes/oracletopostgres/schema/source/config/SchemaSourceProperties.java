package baileyseyes.oracletopostgres.schema.source.config;

import static lombok.AccessLevel.PRIVATE;

import java.util.List;
import lombok.Data;
import lombok.experimental.FieldDefaults;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@FieldDefaults(level = PRIVATE)
@ConfigurationProperties(prefix = "migration.schema.source")
public class SchemaSourceProperties {

    String schema;
    List<String> excludedTables = List.of();
}

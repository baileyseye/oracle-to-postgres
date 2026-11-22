package baileyseyes.oracletopostgres.schema.target.config;

import static lombok.AccessLevel.PRIVATE;

import lombok.Data;
import lombok.experimental.FieldDefaults;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@FieldDefaults(level = PRIVATE)
@ConfigurationProperties(prefix = "migration.schema.target")
public class SchemaTargetProperties {

    String url;
    String username;
    String password;
    String driverClassName;
    String schema = "auto_migration";
}

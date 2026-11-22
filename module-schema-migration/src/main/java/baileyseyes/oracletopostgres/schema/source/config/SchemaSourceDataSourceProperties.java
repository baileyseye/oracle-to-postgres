package baileyseyes.oracletopostgres.schema.source.config;

import static lombok.AccessLevel.PRIVATE;

import lombok.Data;
import lombok.experimental.FieldDefaults;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@FieldDefaults(level = PRIVATE)
@ConfigurationProperties(prefix = "spring.datasource")
public class SchemaSourceDataSourceProperties {

    String url;
    String username;
    String password;
    String driverClassName;
}

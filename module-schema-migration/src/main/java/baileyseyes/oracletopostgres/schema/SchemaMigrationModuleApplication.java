package baileyseyes.oracletopostgres.schema;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class SchemaMigrationModuleApplication {

    static void main(String[] args) {
        SpringApplication.run(SchemaMigrationModuleApplication.class, args);
    }
}

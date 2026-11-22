package baileyseyes.oracletopostgres.migration.service;

import static lombok.AccessLevel.PRIVATE;

import lombok.Data;
import lombok.experimental.FieldDefaults;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Настройки строгости schema validation.
 */
@Data
@FieldDefaults(level = PRIVATE)
@ConfigurationProperties(prefix = "migration.schema.validation")
public class SchemaValidationProperties {

    /**
     * Считать validation неуспешным при наличии WARNING, а не только ERROR.
     */
    boolean failOnWarnings;

    /**
     * Сравнивать CHECK-constraints. Из-за различий диалектов различия выводятся как INFO
     * и требуют ручного review.
     */
    boolean compareCheckConstraints = true;
}

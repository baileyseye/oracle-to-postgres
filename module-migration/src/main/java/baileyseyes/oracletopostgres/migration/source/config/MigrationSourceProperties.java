package baileyseyes.oracletopostgres.migration.source.config;

import static lombok.AccessLevel.PRIVATE;

import java.util.List;
import lombok.Data;
import lombok.experimental.FieldDefaults;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Настройки доступа к источнику миграции.
 */
@Data
@FieldDefaults(level = PRIVATE)
@ConfigurationProperties(prefix = "migration.source")
public class MigrationSourceProperties {

    /**
     * Схема источника; пустое значение означает схему текущего пользователя подключения.
     */
    String schema;

    /**
     * Максимальное число строк, возвращаемых одним запросом чтения.
     */
    int rowLimit = 100;

    /**
     * Служебные таблицы, которые не должны попадать в перечень доступных для миграции.
     */
    List<String> excludedTables = List.of();
}

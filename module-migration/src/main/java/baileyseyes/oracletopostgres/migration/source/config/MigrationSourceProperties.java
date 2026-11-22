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
     * Максимальное число строк, возвращаемых одним запросом чтения для preview-эндпоинта.
     */
    int rowLimit = 100;

    /**
     * Размер страницы keyset-чтения при зеркальной миграции.
     * <br>
     * Определяет верхнюю границу памяти на один чанк и размер одного staging-набора.
     */
    int chunkSize = 5000;

    /**
     * JDBC fetch size для чтения Oracle.
     * <br>
     * Oracle JDBC по умолчанию префетчит около 10 строк; для больших таблиц это
     * превращает чтение в миллионы лишних round-trip'ов.
     */
    int fetchSize = 1000;

    /**
     * Служебные таблицы, которые не должны попадать
     * в перечень доступных для миграции.
     */
    List<String> excludedTables = List.of();
}

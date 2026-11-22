package baileyseyes.oracletopostgres.migration.source.config;

import static lombok.AccessLevel.PRIVATE;

import lombok.Data;
import lombok.experimental.FieldDefaults;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Параметры подключения к Oracle-источнику миграции.
 */
@Data
@FieldDefaults(level = PRIVATE)
@ConfigurationProperties(prefix = "spring.datasource")
public class SourceDataSourceProperties {

    /**
     * JDBC-URL источника.
     */
    String url;

    /**
     * Пользователь источника.
     */
    String username;

    /**
     * Пароль пользователя источника.
     */
    String password;

    /**
     * Полное имя JDBC-драйвера источника.
     */
    String driverClassName;
}

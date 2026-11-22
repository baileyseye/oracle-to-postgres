package baileyseyes.oracletopostgres.migration.target.config;

import static lombok.AccessLevel.PRIVATE;

import lombok.Data;
import lombok.experimental.FieldDefaults;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Параметры подключения к PostgreSQL-приёмнику миграции.
 */
@Data
@FieldDefaults(level = PRIVATE)
@ConfigurationProperties(prefix = "migration.target")
public class MigrationTargetProperties {

    /**
     * JDBC-URL приёмника.
     */
    String url;

    /**
     * Пользователь приёмника.
     */
    String username;

    /**
     * Пароль пользователя приёмника.
     */
    String password;

    /**
     * Полное имя JDBC-драйвера приёмника.
     */
    String driverClassName;

    /**
     * Схема приёмника, в которой лежат таблицы миграции.
     */
    String schema = "public";
}

package baileyseyes.oracletopostgres.migration.source.config;

import com.zaxxer.hikari.HikariDataSource;
import javax.sql.DataSource;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Явная конфигурация DataSource источника.
 * <br>
 * Нужна потому, что в приложении два DataSource:
 * Oracle-источник и PostgreSQL-приёмник.
 */
@Configuration
public class SourceDataSourceConfig {

    @Bean
    @Primary
    @ConfigurationProperties("spring.datasource.hikari")
    public HikariDataSource sourceDataSource(SourceDataSourceProperties properties) {
        HikariDataSource dataSource = new HikariDataSource();
        dataSource.setJdbcUrl(properties.getUrl());
        dataSource.setUsername(properties.getUsername());
        dataSource.setPassword(properties.getPassword());
        dataSource.setDriverClassName(properties.getDriverClassName());
        return dataSource;
    }

    @Bean
    @Primary
    public JdbcTemplate sourceJdbcTemplate(@Qualifier("sourceDataSource") DataSource sourceDataSource,
                                           MigrationSourceProperties migrationSourceProperties) {
        JdbcTemplate jdbcTemplate = new JdbcTemplate(sourceDataSource);
        jdbcTemplate.setFetchSize(migrationSourceProperties.getFetchSize());
        return jdbcTemplate;
    }
}

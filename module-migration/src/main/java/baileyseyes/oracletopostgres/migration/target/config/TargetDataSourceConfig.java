package baileyseyes.oracletopostgres.migration.target.config;

import com.zaxxer.hikari.HikariDataSource;
import javax.sql.DataSource;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.PlatformTransactionManager;

/**
 * Конфигурация DataSource приёмника и отдельного менеджера транзакций.
 */
@Configuration
public class TargetDataSourceConfig {

    @Bean
    @ConfigurationProperties("migration.target.hikari")
    public HikariDataSource targetDataSource(MigrationTargetProperties properties) {
        HikariDataSource dataSource = new HikariDataSource();
        dataSource.setJdbcUrl(properties.getUrl());
        dataSource.setUsername(properties.getUsername());
        dataSource.setPassword(properties.getPassword());
        dataSource.setDriverClassName(properties.getDriverClassName());
        return dataSource;
    }

    @Bean
    public JdbcTemplate targetJdbcTemplate(@Qualifier("targetDataSource") DataSource targetDataSource) {
        return new JdbcTemplate(targetDataSource);
    }

    @Bean
    public PlatformTransactionManager targetTransactionManager(
        @Qualifier("targetDataSource") DataSource targetDataSource) {
        return new DataSourceTransactionManager(targetDataSource);
    }
}

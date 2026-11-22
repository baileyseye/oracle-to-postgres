package baileyseyes.oracletopostgres.schema.target.config;

import com.zaxxer.hikari.HikariDataSource;
import javax.sql.DataSource;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.PlatformTransactionManager;

@Configuration
public class SchemaTargetDataSourceConfig {

    @Bean
    @ConfigurationProperties("migration.schema.target.hikari")
    public HikariDataSource schemaTargetDataSource(SchemaTargetProperties properties) {
        HikariDataSource dataSource = new HikariDataSource();
        dataSource.setJdbcUrl(properties.getUrl());
        dataSource.setUsername(properties.getUsername());
        dataSource.setPassword(properties.getPassword());
        dataSource.setDriverClassName(properties.getDriverClassName());
        return dataSource;
    }

    @Bean
    public JdbcTemplate schemaTargetJdbcTemplate(
        @Qualifier("schemaTargetDataSource") DataSource dataSource) {
        return new JdbcTemplate(dataSource);
    }

    @Bean
    public PlatformTransactionManager schemaTargetTransactionManager(
        @Qualifier("schemaTargetDataSource") DataSource dataSource) {
        return new DataSourceTransactionManager(dataSource);
    }
}

package baileyseyes.oracletopostgres.migration.service;

import baileyseyes.oracletopostgres.migration.common.exception.SourceAccessException;
import baileyseyes.oracletopostgres.migration.common.support.MigrationEntity;
import baileyseyes.oracletopostgres.migration.dto.MigrationStatus;
import baileyseyes.oracletopostgres.migration.source.contract.MetadataProvider;
import baileyseyes.oracletopostgres.migration.target.service.PostgresTargetGateway;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * Сравнение количества строк в Oracle-источнике и PostgreSQL-приёмнике.
 */
@Service
public class MigrationStatisticsService {

    private static final String USERS_TABLE = "users";
    private static final String ORDERS_TABLE = "orders";

    private final MetadataProvider metadataProvider;
    private final JdbcTemplate sourceJdbcTemplate;
    private final PostgresTargetGateway targetGateway;

    public MigrationStatisticsService(MetadataProvider metadataProvider,
                                      @Qualifier("sourceJdbcTemplate") JdbcTemplate sourceJdbcTemplate,
                                      PostgresTargetGateway targetGateway) {
        this.metadataProvider = metadataProvider;
        this.sourceJdbcTemplate = sourceJdbcTemplate;
        this.targetGateway = targetGateway;
    }

    public MigrationStatus getStatus() {
        targetGateway.requireMappingTable();

        return MigrationStatus.builder()
            .sourceUsers(countSource(USERS_TABLE))
            .targetUsers(targetGateway.countUsers())
            .sourceOrders(countSource(ORDERS_TABLE))
            .targetOrders(targetGateway.countOrders())
            .targetManagedUsers(targetGateway.countMappings(MigrationEntity.USER))
            .targetManagedOrders(targetGateway.countMappings(MigrationEntity.ORDER))
            .build();
    }

    private long countSource(String table) {
        String qualifiedTable = metadataProvider.qualifiedTableName(table);

        try {
            Long count = sourceJdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM " + qualifiedTable, Long.class);

            return count == null ? 0 : count;
        } catch (DataAccessException exception) {
            throw new SourceAccessException(
                "Не удалось посчитать строки таблицы '" + table + "' в Oracle", exception);
        }
    }
}

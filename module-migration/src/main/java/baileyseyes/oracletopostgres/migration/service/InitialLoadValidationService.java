package baileyseyes.oracletopostgres.migration.service;

import baileyseyes.oracletopostgres.migration.dto.MigrationValidationReport;
import baileyseyes.oracletopostgres.migration.dto.ValidationCheck;
import baileyseyes.oracletopostgres.migration.source.contract.MetadataProvider;
import baileyseyes.oracletopostgres.migration.target.config.MigrationTargetProperties;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * Сверка Oracle-источника и PostgreSQL-приёмника после initial-load.
 * <br>
 * Сравниваются counts, min/max id, суммы id и бизнес-агрегаты, null-значения,
 * orphan-FK и положение identity/sequence.
 * Полные checksums здесь не используются: для них нужен одинаковый алгоритм
 * в двух СУБД, а агрегаты дают достаточный сигнал
 * при предсказуемом времени проверки.
 */
@Slf4j
@Service
public class InitialLoadValidationService {

    private static final String USERS = "users";
    private static final String ORDERS = "orders";

    private final JdbcTemplate sourceJdbcTemplate;
    private final JdbcTemplate targetJdbcTemplate;
    private final MetadataProvider metadataProvider;
    private final MigrationTargetProperties targetProperties;

    public InitialLoadValidationService(@Qualifier("sourceJdbcTemplate") JdbcTemplate sourceJdbcTemplate,
                                        @Qualifier("targetJdbcTemplate") JdbcTemplate targetJdbcTemplate,
                                        MetadataProvider metadataProvider,
                                        MigrationTargetProperties targetProperties) {
        this.sourceJdbcTemplate = sourceJdbcTemplate;
        this.targetJdbcTemplate = targetJdbcTemplate;
        this.metadataProvider = metadataProvider;
        this.targetProperties = targetProperties;
    }

    /**
     * Выполняет все проверки и возвращает отчёт.
     */
    public MigrationValidationReport validate() {
        String sourceUsers = metadataProvider.qualifiedTableName(USERS);
        String sourceOrders = metadataProvider.qualifiedTableName(ORDERS);
        String targetUsers = qualifiedTable(USERS);
        String targetOrders = qualifiedTable(ORDERS);

        TableStats sourceUserStats = userStats(sourceJdbcTemplate, sourceUsers);
        TableStats targetUserStats = userStats(targetJdbcTemplate, targetUsers);
        TableStats sourceOrderStats = orderStats(sourceJdbcTemplate, sourceOrders);
        TableStats targetOrderStats = orderStats(targetJdbcTemplate, targetOrders);

        List<ValidationCheck> checks = new ArrayList<>();
        addStatsChecks(checks, USERS, sourceUserStats, targetUserStats, "username", "email");
        addStatsChecks(checks, ORDERS, sourceOrderStats, targetOrderStats, "amount", "order_number");

        long sourceOrderOrphans = countOrphans(sourceJdbcTemplate, sourceOrders, sourceUsers);
        long targetOrderOrphans = countOrphans(targetJdbcTemplate, targetOrders, targetUsers);
        checks.add(check("orders.orphanUsers", sourceOrderOrphans, targetOrderOrphans,
            sourceOrderOrphans == 0 && targetOrderOrphans == 0));

        checks.add(check("users.nullFields", 0, targetUserStats.nullCount(), targetUserStats.nullCount() == 0));
        checks.add(check("orders.nullFields", 0, targetOrderStats.nullCount(), targetOrderStats.nullCount() == 0));

        checks.add(sequenceCheck(USERS, targetUserStats.maxId()));
        checks.add(sequenceCheck(ORDERS, targetOrderStats.maxId()));

        boolean valid = checks.stream().allMatch(ValidationCheck::passed);
        MigrationValidationReport report = new MigrationValidationReport(valid, checks);

        if (valid) {
            log.info("Validation initial-load пройдена: проверок={}", checks.size());
        } else {
            log.error("Validation initial-load не пройдена: {}", checks.stream()
                .filter(check -> !check.passed())
                .map(check -> check.name() + " source=" + check.sourceValue()
                    + " target=" + check.targetValue())
                .toList());
        }

        return report;
    }

    private void addStatsChecks(List<ValidationCheck> checks, String table,
                                TableStats source, TableStats target,
                                String metric1Name, String metric2Name) {
        checks.add(check(table + ".count", source.count(), target.count(), source.count() == target.count()));
        checks.add(check(table + ".minId", source.minId(), target.minId(),
            equalObjects(source.minId(), target.minId())));
        checks.add(check(table + ".maxId", source.maxId(), target.maxId(),
            equalObjects(source.maxId(), target.maxId())));
        checks.add(check(table + ".sumId", source.sumId(), target.sumId(),
            equalDecimal(source.sumId(), target.sumId())));
        checks.add(check(table + "." + metric1Name, source.metric1(), target.metric1(),
            equalDecimal(source.metric1(), target.metric1())));
        checks.add(check(table + "." + metric2Name, source.metric2(), target.metric2(),
            equalDecimal(source.metric2(), target.metric2())));
    }

    private TableStats userStats(JdbcTemplate jdbcTemplate, String table) {
        String sql = "SELECT COUNT(*) AS cnt, MIN(id) AS min_id, MAX(id) AS max_id,"
            + " SUM(id) AS sum_id, SUM(LENGTH(username)) AS metric1,"
            + " SUM(LENGTH(email)) AS metric2,"
            + " SUM(CASE WHEN username IS NULL OR email IS NULL"
            + " OR created_at IS NULL OR updated_at IS NULL THEN 1 ELSE 0 END) AS null_count"
            + " FROM " + table;

        return jdbcTemplate.queryForObject(sql, (resultSet, rowNumber) -> new TableStats(
            resultSet.getLong("cnt"),
            toLong(resultSet.getBigDecimal("min_id")),
            toLong(resultSet.getBigDecimal("max_id")),
            resultSet.getBigDecimal("sum_id"),
            resultSet.getBigDecimal("metric1"),
            resultSet.getBigDecimal("metric2"),
            resultSet.getLong("null_count")));
    }

    private TableStats orderStats(JdbcTemplate jdbcTemplate, String table) {
        String sql = "SELECT COUNT(*) AS cnt, MIN(id) AS min_id, MAX(id) AS max_id,"
            + " SUM(id) AS sum_id, SUM(amount) AS metric1,"
            + " SUM(LENGTH(order_number)) AS metric2,"
            + " SUM(CASE WHEN user_id IS NULL OR order_number IS NULL OR amount IS NULL"
            + " OR status IS NULL OR created_at IS NULL THEN 1 ELSE 0 END) AS null_count"
            + " FROM " + table;

        return jdbcTemplate.queryForObject(sql, (resultSet, rowNumber) -> new TableStats(
            resultSet.getLong("cnt"),
            toLong(resultSet.getBigDecimal("min_id")),
            toLong(resultSet.getBigDecimal("max_id")),
            resultSet.getBigDecimal("sum_id"),
            resultSet.getBigDecimal("metric1"),
            resultSet.getBigDecimal("metric2"),
            resultSet.getLong("null_count")));
    }

    private long countOrphans(JdbcTemplate jdbcTemplate, String ordersTable, String usersTable) {
        String sql = "SELECT COUNT(*) FROM " + ordersTable + " o"
            + " LEFT JOIN " + usersTable + " u ON u.id = o.user_id"
            + " WHERE u.id IS NULL";

        Long count = jdbcTemplate.queryForObject(sql, Long.class);
        return count == null ? 0 : count;
    }

    private ValidationCheck sequenceCheck(String table, Long maxId) {
        try {
            String tableName = targetProperties.getSchema() == null || targetProperties.getSchema().isBlank()
                ? table
                : targetProperties.getSchema() + "." + table;
            String sequence = targetJdbcTemplate.queryForObject(
                "SELECT pg_get_serial_sequence(?, 'id')", String.class, tableName);

            if (sequence == null || sequence.isBlank()) {
                return new ValidationCheck(table + ".sequence", String.valueOf(maxId), null, false,
                    "identity/sequence для id не найден");
            }

            String cleaned = sequence.replace("\"", "");
            int separator = cleaned.lastIndexOf('.');
            String sequenceSchema = separator > 0
                ? cleaned.substring(0, separator)
                : targetProperties.getSchema();
            String sequenceName = separator > 0 ? cleaned.substring(separator + 1) : cleaned;
            String sequenceTable = sequenceSchema == null || sequenceSchema.isBlank()
                ? quote(sequenceName)
                : quote(sequenceSchema) + "." + quote(sequenceName);
            BigDecimal lastValue = targetJdbcTemplate.queryForObject(
                "SELECT last_value FROM " + sequenceTable, BigDecimal.class);

            boolean passed = lastValue != null
                && (maxId == null || lastValue.compareTo(BigDecimal.valueOf(maxId)) >= 0);

            return new ValidationCheck(table + ".sequence", String.valueOf(maxId),
                lastValue == null ? null : lastValue.toPlainString(), passed,
                passed ? null : "sequence отстаёт от MAX(id)");
        } catch (DataAccessException exception) {
            return new ValidationCheck(table + ".sequence", String.valueOf(maxId), null, false,
                "не удалось проверить sequence: " + exception.getMessage());
        }
    }

    private ValidationCheck check(String name, Object source, Object target, boolean passed) {
        return new ValidationCheck(name,
            source == null ? null : String.valueOf(source),
            target == null ? null : String.valueOf(target),
            passed,
            passed ? null : "значения не совпадают");
    }

    private boolean equalObjects(Object source, Object target) {
        return source == null ? target == null : source.equals(target);
    }

    private boolean equalDecimal(BigDecimal source, BigDecimal target) {
        if (source == null || target == null) {
            return source == target;
        }

        return source.compareTo(target) == 0;
    }

    private Long toLong(BigDecimal value) {
        return value == null ? null : value.longValue();
    }

    private String qualifiedTable(String table) {
        String schema = targetProperties.getSchema();

        if (schema == null || schema.isBlank()) {
            return quote(table);
        }

        return quote(schema) + "." + quote(table);
    }

    private String quote(String identifier) {
        return "\"" + identifier.replace("\"", "\"\"") + "\"";
    }

    private record TableStats(long count,
                              Long minId,
                              Long maxId,
                              BigDecimal sumId,
                              BigDecimal metric1,
                              BigDecimal metric2,
                              long nullCount) {
    }
}

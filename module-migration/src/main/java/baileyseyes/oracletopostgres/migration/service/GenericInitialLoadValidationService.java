package baileyseyes.oracletopostgres.migration.service;

import baileyseyes.oracletopostgres.migration.common.exception.SourceAccessException;
import baileyseyes.oracletopostgres.migration.common.exception.TargetAccessException;
import baileyseyes.oracletopostgres.migration.common.support.ForeignKeyMetadata;
import baileyseyes.oracletopostgres.migration.dto.MigrationValidationReport;
import baileyseyes.oracletopostgres.migration.dto.ValidationCheck;
import baileyseyes.oracletopostgres.migration.service.plan.InitialLoadTablePlan;
import baileyseyes.oracletopostgres.migration.service.plan.TableColumnPlan;
import baileyseyes.oracletopostgres.migration.source.contract.MetadataProvider;
import baileyseyes.oracletopostgres.migration.target.config.MigrationTargetProperties;
import baileyseyes.oracletopostgres.migration.target.service.PostgresTargetGateway;
import java.math.BigDecimal;
import java.sql.Types;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * Validation generic-таблиц: агрегаты по общим колонкам и orphan-FK.
 */
@Slf4j
@Service
public class GenericInitialLoadValidationService {

    private static final Set<Integer> NUMERIC_TYPES = Set.of(
        Types.TINYINT, Types.SMALLINT, Types.INTEGER, Types.BIGINT,
        Types.NUMERIC, Types.DECIMAL, Types.REAL, Types.FLOAT, Types.DOUBLE);
    private static final Set<Integer> TEXT_TYPES = Set.of(
        Types.CHAR, Types.VARCHAR, Types.LONGVARCHAR,
        Types.NCHAR, Types.NVARCHAR, Types.LONGNVARCHAR,
        Types.CLOB, Types.NCLOB);

    private final JdbcTemplate sourceJdbcTemplate;
    private final JdbcTemplate targetJdbcTemplate;
    private final MetadataProvider metadataProvider;
    private final PostgresTargetGateway targetGateway;
    private final MigrationTargetProperties targetProperties;

    public GenericInitialLoadValidationService(@Qualifier("sourceJdbcTemplate") JdbcTemplate sourceJdbcTemplate,
                                               @Qualifier("targetJdbcTemplate") JdbcTemplate targetJdbcTemplate,
                                               MetadataProvider metadataProvider,
                                               PostgresTargetGateway targetGateway,
                                               MigrationTargetProperties targetProperties) {
        this.sourceJdbcTemplate = sourceJdbcTemplate;
        this.targetJdbcTemplate = targetJdbcTemplate;
        this.metadataProvider = metadataProvider;
        this.targetGateway = targetGateway;
        this.targetProperties = targetProperties;
    }

    public MigrationValidationReport validate(List<InitialLoadTablePlan> plans) {
        List<ValidationCheck> checks = new ArrayList<>();

        for (InitialLoadTablePlan plan : plans) {
            validateTable(plan, checks);
            validateForeignKeys(plan, checks);
        }

        boolean valid = checks.stream().allMatch(ValidationCheck::passed);

        if (valid) {
            log.info("Generic validation пройдена: таблиц={}, проверок={}", plans.size(), checks.size());
        } else {
            log.error("Generic validation не пройдена: {}", checks.stream()
                .filter(check -> !check.passed())
                .map(check -> check.name() + " source=" + check.sourceValue()
                    + " target=" + check.targetValue())
                .toList());
        }

        return new MigrationValidationReport(valid, checks);
    }

    private void validateTable(InitialLoadTablePlan plan, List<ValidationCheck> checks) {
        String sourceTable = metadataProvider.qualifiedTableName(plan.sourceTable());
        String targetTable = qualifiedTable(plan.targetTable());
        List<Aggregate> sourceAggregates = aggregates(plan, true);
        List<Aggregate> targetAggregates = aggregates(plan, false);

        TableStats source = stats(sourceJdbcTemplate, sourceTable, sourceAggregates, true);
        TableStats target = stats(targetJdbcTemplate, targetTable, targetAggregates, false);

        checks.add(check(plan.targetTable() + ".count", source.count(), target.count(),
            source.count() == target.count()));

        for (Aggregate aggregate : sourceAggregates) {
            BigDecimal sourceValue = source.values().get(aggregate.name());
            BigDecimal targetValue = target.values().get(aggregate.name());
            boolean passed = equalDecimal(sourceValue, targetValue);

            checks.add(check(plan.targetTable() + "." + aggregate.name(), sourceValue, targetValue, passed));
        }
    }

    private List<Aggregate> aggregates(InitialLoadTablePlan plan, boolean source) {
        List<Aggregate> aggregates = new ArrayList<>();
        String keyColumn = source ? plan.sourceKeyColumn() : plan.targetKeyColumn();

        if (plan.keyset()) {
            aggregates.add(new Aggregate("key.min", "MIN(" + quote(keyColumn) + ")"));
            aggregates.add(new Aggregate("key.max", "MAX(" + quote(keyColumn) + ")"));
            aggregates.add(new Aggregate("key.sum", "SUM(" + quote(keyColumn) + ")"));
        }

        for (TableColumnPlan column : plan.columns()) {
            String name = source ? column.sourceColumn() : column.targetColumn();

            if (NUMERIC_TYPES.contains(column.targetJdbcType())) {
                aggregates.add(new Aggregate(column.targetColumn() + ".sum", "SUM(" + quote(name) + ")"));
            } else if (TEXT_TYPES.contains(column.targetJdbcType())) {
                aggregates.add(new Aggregate(column.targetColumn() + ".length",
                    "SUM(LENGTH(" + quote(name) + "))"));
            }

            aggregates.add(new Aggregate(column.targetColumn() + ".nulls",
                "SUM(CASE WHEN " + quote(name) + " IS NULL THEN 1 ELSE 0 END)"));
        }

        return aggregates;
    }

    private TableStats stats(JdbcTemplate jdbcTemplate, String table, List<Aggregate> aggregates,
                             boolean source) {
        StringBuilder sql = new StringBuilder("SELECT COUNT(*) AS cnt");

        for (int index = 0; index < aggregates.size(); index++) {
            sql.append(", ").append(aggregates.get(index).expression())
                .append(" AS a").append(index);
        }

        sql.append(" FROM ").append(table);

        try {
            return jdbcTemplate.queryForObject(sql.toString(), (resultSet, rowNumber) -> {
                Map<String, BigDecimal> values = new LinkedHashMap<>();

                for (int index = 0; index < aggregates.size(); index++) {
                    values.put(aggregates.get(index).name(), resultSet.getBigDecimal("a" + index));
                }

                return new TableStats(resultSet.getLong("cnt"), values);
            });
        } catch (DataAccessException exception) {
            if (source) {
                throw new SourceAccessException("Не удалось выполнить validation source-таблицы '"
                    + table + "'", exception);
            }

            throw new TargetAccessException("Не удалось выполнить validation target-таблицы '"
                + table + "'", exception);
        }
    }

    private void validateForeignKeys(InitialLoadTablePlan plan, List<ValidationCheck> checks) {
        for (ForeignKeyMetadata foreignKey : targetGateway.foreignKeys(plan.targetTable())) {
            String child = qualifiedTable(plan.targetTable());
            String parent = qualifiedTable(foreignKey.referencedTable());
            StringBuilder join = new StringBuilder();

            for (int index = 0; index < foreignKey.columns().size(); index++) {
                if (index > 0) {
                    join.append(" AND ");
                }

                join.append("c.").append(quote(foreignKey.columns().get(index)))
                    .append(" = p.").append(quote(foreignKey.referencedColumns().get(index)));
            }

            String notNullColumn = quote(foreignKey.columns().getFirst());
            String sql = "SELECT COUNT(*) FROM " + child + " c"
                + " LEFT JOIN " + parent + " p ON " + join
                + " WHERE p." + quote(foreignKey.referencedColumns().getFirst()) + " IS NULL"
                + " AND c." + notNullColumn + " IS NOT NULL";

            Long orphans = targetJdbcTemplate.queryForObject(sql, Long.class);
            long count = orphans == null ? 0 : orphans;
            checks.add(check(plan.targetTable() + "." + foreignKey.name() + ".orphans",
                0, count, count == 0));
        }
    }

    private ValidationCheck check(String name, Object source, Object target, boolean passed) {
        return new ValidationCheck(name,
            source == null ? null : String.valueOf(source),
            target == null ? null : String.valueOf(target),
            passed,
            passed ? null : "значения не совпадают");
    }

    private boolean equalDecimal(BigDecimal source, BigDecimal target) {
        if (source == null || target == null) {
            return source == target;
        }

        return source.compareTo(target) == 0;
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

    private record Aggregate(String name, String expression) {
    }

    private record TableStats(long count, Map<String, BigDecimal> values) {
    }
}

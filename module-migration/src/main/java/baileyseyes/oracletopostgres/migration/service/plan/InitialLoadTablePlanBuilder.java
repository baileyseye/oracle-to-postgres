package baileyseyes.oracletopostgres.migration.service.plan;

import baileyseyes.oracletopostgres.migration.common.exception.MigrationException;
import baileyseyes.oracletopostgres.migration.common.support.ColumnMetadata;
import baileyseyes.oracletopostgres.migration.common.support.ForeignKeyMetadata;
import baileyseyes.oracletopostgres.migration.common.support.PrimaryKeyMetadata;
import baileyseyes.oracletopostgres.migration.service.InitialLoadProperties;
import baileyseyes.oracletopostgres.migration.source.contract.MetadataProvider;
import baileyseyes.oracletopostgres.migration.target.service.PostgresTargetGateway;
import java.sql.Types;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Строит планы initial-load для таблиц, которые не обрабатываются
 * специализированным путём users/orders.
 * <br>
 * Колонки сопоставляются по имени без учёта регистра.
 * Колонки target, которых нет в source, допускаются только если они
 * nullable/default/identity.
 */
@Slf4j
@Service
public class InitialLoadTablePlanBuilder {

    private static final Set<String> SPECIALIZED_TABLES = Set.of("users", "orders");
    private static final Set<Integer> INTEGER_KEY_TYPES = Set.of(
        Types.TINYINT, Types.SMALLINT, Types.INTEGER, Types.BIGINT,
        Types.NUMERIC, Types.DECIMAL);

    private final MetadataProvider metadataProvider;
    private final PostgresTargetGateway targetGateway;
    private final InitialLoadProperties properties;

    public InitialLoadTablePlanBuilder(MetadataProvider metadataProvider,
                                       PostgresTargetGateway targetGateway,
                                       InitialLoadProperties properties) {
        this.metadataProvider = metadataProvider;
        this.targetGateway = targetGateway;
        this.properties = properties;
    }

    /**
     * Возвращает планы в порядке, безопасном для FK.
     */
    public List<InitialLoadTablePlan> buildPlans() {
        Set<String> include = lowerSet(properties.getIncludeTables());
        Set<String> exclude = lowerSet(properties.getExcludeTables());
        Set<String> targetTables = targetGateway.listTables().stream()
            .map(table -> table.toLowerCase(Locale.ROOT))
            .collect(java.util.stream.Collectors.toSet());

        Map<String, InitialLoadTablePlan> plansByTarget = new LinkedHashMap<>();

        for (String sourceTable : metadataProvider.listTables()) {
            String sourceLower = sourceTable.toLowerCase(Locale.ROOT);

            if (SPECIALIZED_TABLES.contains(sourceLower)) {
                continue;
            }

            if (!include.isEmpty() && !include.contains(sourceLower)) {
                continue;
            }

            if (exclude.contains(sourceLower)) {
                continue;
            }

            String targetTable = resolveTargetTable(sourceTable).toLowerCase(Locale.ROOT);

            if (!targetTables.contains(targetTable)) {
                throw new MigrationException("Target-таблица '" + targetTable
                    + "' для source-таблицы '" + sourceTable + "' не найдена");
            }

            InitialLoadTablePlan plan = buildPlan(sourceTable, targetTable);
            plansByTarget.put(targetTable, plan);
        }

        if (plansByTarget.isEmpty()) {
            return List.of();
        }

        List<InitialLoadTablePlan> ordered = orderByForeignKeys(plansByTarget);
        log.info("Generic initial-load: таблиц={}, порядок={}", ordered.size(),
            ordered.stream().map(InitialLoadTablePlan::targetTable).toList());
        return ordered;
    }

    private InitialLoadTablePlan buildPlan(String sourceTable, String targetTable) {
        List<ColumnMetadata> sourceColumns = metadataProvider.listColumnMetadata(sourceTable);
        List<ColumnMetadata> targetColumns = targetGateway.listColumnMetadata(targetTable);
        Map<String, ColumnMetadata> sourceByName = byLowerName(sourceColumns);
        Map<String, ColumnMetadata> targetByName = byLowerName(targetColumns);
        Map<String, String> configuredColumns = resolveColumnMapping(sourceTable);
        Map<String, String> targetToSource = new LinkedHashMap<>();
        Map<String, String> sourceToTarget = new LinkedHashMap<>();

        for (ColumnMetadata sourceColumn : sourceColumns) {
            String targetName = configuredTarget(configuredColumns, sourceColumn.name());
            targetToSource.put(targetName.toLowerCase(Locale.ROOT), sourceColumn.name());
            sourceToTarget.put(sourceColumn.name().toLowerCase(Locale.ROOT), targetName);
        }

        List<TableColumnPlan> columns = new ArrayList<>();
        boolean hasLobs = false;

        for (ColumnMetadata targetColumn : targetColumns) {
            String targetLower = targetColumn.name().toLowerCase(Locale.ROOT);
            String sourceName = targetToSource.get(targetLower);
            ColumnMetadata sourceColumn = sourceName == null
                ? sourceByName.get(targetLower)
                : sourceByName.get(sourceName.toLowerCase(Locale.ROOT));

            if (sourceColumn == null) {
                if (!targetColumn.nullable() && !hasDefault(targetColumn) && !targetColumn.autoIncrement()) {
                    throw new MigrationException("В target-таблице '" + targetTable + "' колонка '"
                        + targetColumn.name() + "' обязательна, но отсутствует в source '"
                        + sourceTable + "'");
                }

                continue;
            }

            columns.add(new TableColumnPlan(
                sourceColumn.name(), targetColumn.name(),
                targetColumn.jdbcType(), targetColumn.typeName()));
            hasLobs = hasLobs || isLob(sourceColumn);
        }

        if (columns.isEmpty()) {
            throw new MigrationException("Для таблицы '" + sourceTable
                + "' не найдено ни одной общей колонки с target '" + targetTable + "'");
        }

        Optional<PrimaryKeyMetadata> primaryKey = metadataProvider.primaryKey(sourceTable);
        String sourceKey = null;
        String targetKey = null;

        if (primaryKey.isPresent() && primaryKey.get().columns().size() == 1) {
            String candidate = primaryKey.get().columns().getFirst();
            ColumnMetadata sourceKeyMetadata = sourceByName.get(candidate.toLowerCase(Locale.ROOT));
            String targetCandidate = sourceToTarget.getOrDefault(
                candidate.toLowerCase(Locale.ROOT), candidate);
            ColumnMetadata targetKeyMetadata = targetByName.get(targetCandidate.toLowerCase(Locale.ROOT));

            if (sourceKeyMetadata != null && targetKeyMetadata != null
                && isIntegerKey(sourceKeyMetadata) && isIntegerKey(targetKeyMetadata)) {
                sourceKey = sourceKeyMetadata.name();
                targetKey = targetKeyMetadata.name();
            }
        }

        return new InitialLoadTablePlan(
            sourceTable, targetTable, columns, sourceKey, targetKey, sourceKey != null, hasLobs);
    }

    private Map<String, String> resolveColumnMapping(String sourceTable) {
        for (Map.Entry<String, Map<String, String>> entry : properties.getColumnMapping().entrySet()) {
            if (entry.getKey().equalsIgnoreCase(sourceTable)) {
                return entry.getValue();
            }
        }

        return Map.of();
    }

    private String configuredTarget(Map<String, String> configuredColumns, String sourceColumn) {
        for (Map.Entry<String, String> entry : configuredColumns.entrySet()) {
            if (entry.getKey().equalsIgnoreCase(sourceColumn)) {
                return entry.getValue();
            }
        }

        return sourceColumn;
    }

    private List<InitialLoadTablePlan> orderByForeignKeys(Map<String, InitialLoadTablePlan> plansByTarget) {
        Map<String, Set<String>> dependencies = new HashMap<>();

        for (InitialLoadTablePlan plan : plansByTarget.values()) {
            Set<String> parents = new LinkedHashSet<>();

            for (ForeignKeyMetadata foreignKey : targetGateway.foreignKeys(plan.targetTable())) {
                String parent = foreignKey.referencedTable().toLowerCase(Locale.ROOT);

                if (plansByTarget.containsKey(parent)) {
                    parents.add(parent);
                }
            }

            dependencies.put(plan.targetTable(), parents);
        }

        List<InitialLoadTablePlan> ordered = new ArrayList<>();
        Set<String> visiting = new HashSet<>();
        Set<String> visited = new HashSet<>();

        for (String table : plansByTarget.keySet()) {
            visit(table, plansByTarget, dependencies, visiting, visited, ordered);
        }

        if (ordered.size() != plansByTarget.size()) {
            throw new MigrationException("Не удалось определить порядок таблиц по FK");
        }

        return ordered;
    }

    private void visit(String table,
                       Map<String, InitialLoadTablePlan> plans,
                       Map<String, Set<String>> dependencies,
                       Set<String> visiting,
                       Set<String> visited,
                       List<InitialLoadTablePlan> ordered) {
        if (visited.contains(table)) {
            return;
        }

        if (!visiting.add(table)) {
            if (properties.getPreLoadSql() == null || properties.getPreLoadSql().isBlank()) {
                throw new MigrationException("Циклические FK вокруг таблицы '" + table
                    + "'. Настройте pre-load-sql, который снимает FK перед загрузкой.");
            }

            log.warn("Циклические FK вокруг таблицы {}; pre-load-sql задан, "
                + "порядок остаётся детерминированным", table);
            return;
        }

        for (String parent : dependencies.getOrDefault(table, Set.of())) {
            visit(parent, plans, dependencies, visiting, visited, ordered);
        }

        visiting.remove(table);
        visited.add(table);
        ordered.add(plans.get(table));
    }

    private String resolveTargetTable(String sourceTable) {
        for (Map.Entry<String, String> entry : properties.getTableMapping().entrySet()) {
            if (entry.getKey().equalsIgnoreCase(sourceTable)) {
                return entry.getValue();
            }
        }

        return sourceTable.toLowerCase(Locale.ROOT);
    }

    private Map<String, ColumnMetadata> byLowerName(List<ColumnMetadata> columns) {
        Map<String, ColumnMetadata> result = new LinkedHashMap<>();

        for (ColumnMetadata column : columns) {
            result.put(column.name().toLowerCase(Locale.ROOT), column);
        }

        return result;
    }

    private Set<String> lowerSet(List<String> values) {
        Set<String> result = new LinkedHashSet<>();

        for (String value : values) {
            result.add(value.toLowerCase(Locale.ROOT));
        }

        return result;
    }

    private boolean hasDefault(ColumnMetadata column) {
        return column.defaultValue() != null && !column.defaultValue().isBlank();
    }

    private boolean isIntegerKey(ColumnMetadata column) {
        return INTEGER_KEY_TYPES.contains(column.jdbcType()) && column.decimalDigits() == 0;
    }

    private boolean isLob(ColumnMetadata column) {
        String type = column.typeName() == null ? "" : column.typeName().toUpperCase(Locale.ROOT);

        return type.contains("LOB")
            || type.startsWith("LONG")
            || type.startsWith("RAW")
            || column.jdbcType() == Types.CLOB
            || column.jdbcType() == Types.BLOB
            || column.jdbcType() == Types.LONGVARCHAR
            || column.jdbcType() == Types.LONGVARBINARY;
    }
}

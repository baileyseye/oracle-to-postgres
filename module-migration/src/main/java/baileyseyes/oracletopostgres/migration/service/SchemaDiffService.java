package baileyseyes.oracletopostgres.migration.service;

import baileyseyes.oracletopostgres.migration.common.support.CheckConstraintMetadata;
import baileyseyes.oracletopostgres.migration.common.support.ColumnMetadata;
import baileyseyes.oracletopostgres.migration.common.support.ForeignKeyMetadata;
import baileyseyes.oracletopostgres.migration.common.support.IndexMetadata;
import baileyseyes.oracletopostgres.migration.common.support.PrimaryKeyMetadata;
import baileyseyes.oracletopostgres.migration.common.support.SchemaIssueSeverity;
import baileyseyes.oracletopostgres.migration.common.support.SchemaObjectType;
import baileyseyes.oracletopostgres.migration.dto.SchemaDiffReport;
import baileyseyes.oracletopostgres.migration.dto.SchemaIssue;
import baileyseyes.oracletopostgres.migration.dto.TableDiff;
import baileyseyes.oracletopostgres.migration.source.config.MigrationSourceProperties;
import baileyseyes.oracletopostgres.migration.source.contract.MetadataProvider;
import baileyseyes.oracletopostgres.migration.target.config.MigrationTargetProperties;
import baileyseyes.oracletopostgres.migration.target.service.PostgresTargetGateway;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Сравнение схемы Oracle-источника с фактической схемой PostgreSQL-приёмника.
 * <br>
 * Проверяются наличие таблиц и колонок, совместимость типов, nullable, defaults,
 * identity, первичные ключи, внешние ключи, unique/индексы и CHECK-constraints.
 * Имена constraints и индексов не сравниваются: в Oracle и PostgreSQL они различаются.
 * <br>
 * ERROR означает, что validation не проходит. WARNING требует внимания, но не блокирует
 * validation (если не включён {@code fail-on-warnings}). INFO — материал для ручного review.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SchemaDiffService {

    private final MetadataProvider metadataProvider;
    private final PostgresTargetGateway targetGateway;
    private final MigrationSourceProperties sourceProperties;
    private final MigrationTargetProperties targetProperties;
    private final SchemaValidationProperties validationProperties;

    public SchemaDiffReport diff() {
        List<String> sourceTables = metadataProvider.listTables();
        Map<String, String> targetTablesByName = new LinkedHashMap<>();

        for (String targetTable : targetGateway.listTables()) {
            targetTablesByName.put(targetTable.toLowerCase(Locale.ROOT), targetTable);
        }

        List<TableDiff> tableDiffs = new ArrayList<>();
        int missingTables = 0;
        int missingColumns = 0;
        int missingIndexes = 0;
        int errors = 0;
        int warnings = 0;
        int infos = 0;

        for (String sourceTable : sourceTables) {
            String targetTable = targetTablesByName.get(sourceTable.toLowerCase(Locale.ROOT));

            if (targetTable == null) {
                missingTables++;
                List<SchemaIssue> issues = List.of(issue(
                    SchemaIssueSeverity.ERROR,
                    SchemaObjectType.TABLE,
                    sourceTable,
                    "Таблица отсутствует в PostgreSQL",
                    sourceTable,
                    null));

                errors++;
                tableDiffs.add(TableDiff.builder()
                    .table(sourceTable)
                    .presentInTarget(false)
                    .missingColumns(List.of())
                    .missingIndexes(List.of())
                    .issues(issues)
                    .build());
                continue;
            }

            List<SchemaIssue> issues = new ArrayList<>();
            List<String> tableMissingColumns = compareColumns(sourceTable, targetTable, issues);
            comparePrimaryKey(sourceTable, targetTable, issues);
            compareForeignKeys(sourceTable, targetTable, issues);
            List<IndexMetadata> tableMissingIndexes = compareIndexes(sourceTable, targetTable, issues);

            if (validationProperties.isCompareCheckConstraints()) {
                compareCheckConstraints(sourceTable, targetTable, issues);
            }

            missingColumns += tableMissingColumns.size();
            missingIndexes += tableMissingIndexes.size();
            errors += count(issues, SchemaIssueSeverity.ERROR);
            warnings += count(issues, SchemaIssueSeverity.WARNING);
            infos += count(issues, SchemaIssueSeverity.INFO);

            tableDiffs.add(TableDiff.builder()
                .table(sourceTable)
                .presentInTarget(true)
                .missingColumns(tableMissingColumns)
                .missingIndexes(tableMissingIndexes)
                .issues(issues)
                .build());
        }

        boolean valid = errors == 0
            && (!validationProperties.isFailOnWarnings() || warnings == 0);

        SchemaDiffReport report = SchemaDiffReport.builder()
            .sourceSchema(displaySchema(sourceProperties.getSchema()))
            .targetSchema(displaySchema(targetProperties.getSchema()))
            .checkedTables(sourceTables.size())
            .missingTables(missingTables)
            .missingColumns(missingColumns)
            .missingIndexes(missingIndexes)
            .errors(errors)
            .warnings(warnings)
            .infos(infos)
            .valid(valid)
            .tables(tableDiffs)
            .build();

        log.info("Сравнение схем завершено: таблиц={}, errors={}, warnings={}, infos={}",
            report.getCheckedTables(), errors, warnings, infos);

        return report;
    }

    private List<String> compareColumns(String sourceTable, String targetTable, List<SchemaIssue> issues) {
        List<ColumnMetadata> sourceColumns = metadataProvider.listColumnMetadata(sourceTable);
        Map<String, ColumnMetadata> targetColumns = targetGateway.listColumnMetadata(targetTable).stream()
            .collect(Collectors.toMap(
                column -> column.name().toLowerCase(Locale.ROOT),
                column -> column,
                (first, second) -> first,
                LinkedHashMap::new));

        List<String> missingColumns = new ArrayList<>();

        for (ColumnMetadata sourceColumn : sourceColumns) {
            ColumnMetadata targetColumn = targetColumns.get(sourceColumn.name().toLowerCase(Locale.ROOT));

            if (targetColumn == null) {
                missingColumns.add(sourceColumn.name());
                issues.add(issue(
                    SchemaIssueSeverity.ERROR,
                    SchemaObjectType.COLUMN,
                    sourceColumn.name(),
                    "Колонка отсутствует в PostgreSQL",
                    describeColumn(sourceColumn),
                    null));
                continue;
            }

            compareColumnType(sourceColumn, targetColumn, issues);
            compareNullability(sourceColumn, targetColumn, issues);
            compareDefault(sourceColumn, targetColumn, issues);
            compareIdentity(sourceColumn, targetColumn, issues);
        }

        return missingColumns;
    }

    private void compareColumnType(ColumnMetadata sourceColumn, ColumnMetadata targetColumn,
                                   List<SchemaIssue> issues) {
        SchemaTypeCompatibility.check(sourceColumn, targetColumn).ifPresent(result ->
            issues.add(issue(
                result.severity(),
                SchemaObjectType.COLUMN,
                sourceColumn.name(),
                result.message(),
                result.sourceValue(),
                result.targetValue())));
    }

    private void compareNullability(ColumnMetadata sourceColumn, ColumnMetadata targetColumn,
                                    List<SchemaIssue> issues) {
        if (sourceColumn.nullable() && !targetColumn.nullable()) {
            issues.add(issue(
                SchemaIssueSeverity.ERROR,
                SchemaObjectType.COLUMN,
                sourceColumn.name(),
                "Целевая колонка NOT NULL, но источник допускает NULL",
                "NULL allowed",
                "NOT NULL"));
        } else if (!sourceColumn.nullable() && targetColumn.nullable()) {
            issues.add(issue(
                SchemaIssueSeverity.WARNING,
                SchemaObjectType.COLUMN,
                sourceColumn.name(),
                "Целевая колонка допускает NULL, но источник NOT NULL",
                "NOT NULL",
                "NULL allowed"));
        }
    }

    private void compareDefault(ColumnMetadata sourceColumn, ColumnMetadata targetColumn,
                                List<SchemaIssue> issues) {
        if (sourceColumn.autoIncrement() || targetColumn.autoIncrement()) {
            return;
        }

        String sourceDefault = normalizeDefault(sourceColumn.defaultValue());
        String targetDefault = normalizeDefault(targetColumn.defaultValue());

        if (sourceDefault == null && targetDefault == null) {
            return;
        }

        if (sourceDefault == null || targetDefault == null || !sourceDefault.equals(targetDefault)) {
            issues.add(issue(
                SchemaIssueSeverity.WARNING,
                SchemaObjectType.DEFAULT,
                sourceColumn.name(),
                "Default-значение отличается",
                sourceColumn.defaultValue(),
                targetColumn.defaultValue()));
        }
    }

    private void compareIdentity(ColumnMetadata sourceColumn, ColumnMetadata targetColumn,
                                 List<SchemaIssue> issues) {
        if (sourceColumn.autoIncrement() != targetColumn.autoIncrement()) {
            issues.add(issue(
                SchemaIssueSeverity.WARNING,
                SchemaObjectType.COLUMN,
                sourceColumn.name(),
                "Признак identity/auto-increment отличается",
                String.valueOf(sourceColumn.autoIncrement()),
                String.valueOf(targetColumn.autoIncrement())));
        }
    }

    private void comparePrimaryKey(String sourceTable, String targetTable, List<SchemaIssue> issues) {
        Optional<PrimaryKeyMetadata> sourceKey = metadataProvider.primaryKey(sourceTable);
        Optional<PrimaryKeyMetadata> targetKey = targetGateway.primaryKey(targetTable);

        if (sourceKey.isPresent() && targetKey.isEmpty()) {
            issues.add(issue(
                SchemaIssueSeverity.ERROR,
                SchemaObjectType.PRIMARY_KEY,
                sourceKey.get().name(),
                "Первичный ключ отсутствует в PostgreSQL",
                columns(sourceKey.get().columns()),
                null));
            return;
        }

        if (sourceKey.isEmpty() && targetKey.isPresent()) {
            issues.add(issue(
                SchemaIssueSeverity.WARNING,
                SchemaObjectType.PRIMARY_KEY,
                targetKey.get().name(),
                "В PostgreSQL есть PRIMARY KEY, которого нет в Oracle",
                null,
                columns(targetKey.get().columns())));
            return;
        }

        if (sourceKey.isPresent() && targetKey.isPresent()
            && !sameColumns(sourceKey.get().columns(), targetKey.get().columns())) {
            issues.add(issue(
                SchemaIssueSeverity.ERROR,
                SchemaObjectType.PRIMARY_KEY,
                sourceKey.get().name(),
                "Состав колонок PRIMARY KEY отличается",
                columns(sourceKey.get().columns()),
                columns(targetKey.get().columns())));
        }
    }

    private void compareForeignKeys(String sourceTable, String targetTable, List<SchemaIssue> issues) {
        List<ForeignKeyMetadata> sourceKeys = metadataProvider.foreignKeys(sourceTable);
        List<ForeignKeyMetadata> targetKeys = targetGateway.foreignKeys(targetTable);
        Map<String, ForeignKeyMetadata> targetByKey = new LinkedHashMap<>();

        for (ForeignKeyMetadata targetKey : targetKeys) {
            targetByKey.putIfAbsent(foreignKeyKey(targetKey), targetKey);
        }

        Set<String> sourceKeySet = new LinkedHashSet<>();

        for (ForeignKeyMetadata sourceKey : sourceKeys) {
            String key = foreignKeyKey(sourceKey);
            sourceKeySet.add(key);
            ForeignKeyMetadata targetKey = targetByKey.get(key);

            if (targetKey == null) {
                issues.add(issue(
                    SchemaIssueSeverity.ERROR,
                    SchemaObjectType.FOREIGN_KEY,
                    sourceKey.name(),
                    "Внешний ключ отсутствует в PostgreSQL",
                    describeForeignKey(sourceKey),
                    null));
                continue;
            }

            if (!sourceKey.updateRule().equalsIgnoreCase(targetKey.updateRule())
                || !sourceKey.deleteRule().equalsIgnoreCase(targetKey.deleteRule())) {
                issues.add(issue(
                    SchemaIssueSeverity.ERROR,
                    SchemaObjectType.FOREIGN_KEY,
                    sourceKey.name(),
                    "Правила ON UPDATE / ON DELETE отличаются",
                    sourceKey.updateRule() + " / " + sourceKey.deleteRule(),
                    targetKey.updateRule() + " / " + targetKey.deleteRule()));
            }
        }

        for (ForeignKeyMetadata targetKey : targetKeys) {
            if (!sourceKeySet.contains(foreignKeyKey(targetKey))) {
                issues.add(issue(
                    SchemaIssueSeverity.WARNING,
                    SchemaObjectType.FOREIGN_KEY,
                    targetKey.name(),
                    "В PostgreSQL есть внешний ключ, которого нет в Oracle",
                    null,
                    describeForeignKey(targetKey)));
            }
        }
    }

    private List<IndexMetadata> compareIndexes(String sourceTable, String targetTable,
                                               List<SchemaIssue> issues) {
        Map<String, IndexMetadata> sourceIndexes = new LinkedHashMap<>();

        for (IndexMetadata sourceIndex : metadataProvider.listIndexes(sourceTable)) {
            sourceIndexes.putIfAbsent(indexKey(sourceIndex), sourceIndex);
        }

        Set<String> targetIndexes = targetGateway.listIndexes(targetTable).stream()
            .map(this::indexKey)
            .collect(Collectors.toCollection(LinkedHashSet::new));
        Set<String> primaryKeyColumns = metadataProvider.primaryKey(sourceTable)
            .map(key -> normalizeColumns(key.columns()))
            .orElse(Set.of());

        List<IndexMetadata> missingIndexes = new ArrayList<>();

        for (Map.Entry<String, IndexMetadata> entry : sourceIndexes.entrySet()) {
            if (targetIndexes.contains(entry.getKey())) {
                continue;
            }

            IndexMetadata index = entry.getValue();

            if (index.unique() && !primaryKeyColumns.isEmpty()
                && primaryKeyColumns.equals(normalizeColumns(index.columns()))) {
                continue;
            }

            missingIndexes.add(index);
            issues.add(issue(
                index.unique() ? SchemaIssueSeverity.ERROR : SchemaIssueSeverity.WARNING,
                index.unique() ? SchemaObjectType.UNIQUE : SchemaObjectType.INDEX,
                columns(index.columns()),
                index.unique()
                    ? "Уникальный индекс/constraint отсутствует в PostgreSQL"
                    : "Индекс отсутствует в PostgreSQL",
                columns(index.columns()),
                null));
        }

        return missingIndexes;
    }

    private void compareCheckConstraints(String sourceTable, String targetTable,
                                         List<SchemaIssue> issues) {
        List<CheckConstraintMetadata> sourceChecks = metadataProvider.checkConstraints(sourceTable).stream()
            .filter(check -> !isNotNullCheck(check))
            .toList();
        List<CheckConstraintMetadata> targetChecks = targetGateway.checkConstraints(targetTable).stream()
            .filter(check -> !isNotNullCheck(check))
            .toList();

        if (sourceChecks.isEmpty() && targetChecks.isEmpty()) {
            return;
        }

        String sourceValue = checks(sourceChecks);
        String targetValue = checks(targetChecks);

        if (!sourceChecks.isEmpty() && targetChecks.isEmpty()) {
            issues.add(issue(
                SchemaIssueSeverity.WARNING,
                SchemaObjectType.CHECK,
                sourceTable,
                "CHECK-constraints отсутствуют в PostgreSQL",
                sourceValue,
                null));
            return;
        }

        if (sourceChecks.isEmpty()) {
            issues.add(issue(
                SchemaIssueSeverity.INFO,
                SchemaObjectType.CHECK,
                sourceTable,
                "В PostgreSQL есть дополнительные CHECK-constraints",
                null,
                targetValue));
            return;
        }

        Set<String> sourceExpressions = sourceChecks.stream()
            .map(CheckConstraintMetadata::expression)
            .map(this::normalizeCheck)
            .collect(Collectors.toCollection(LinkedHashSet::new));
        Set<String> targetExpressions = targetChecks.stream()
            .map(CheckConstraintMetadata::expression)
            .map(this::normalizeCheck)
            .collect(Collectors.toCollection(LinkedHashSet::new));

        if (!sourceExpressions.equals(targetExpressions)) {
            issues.add(issue(
                SchemaIssueSeverity.INFO,
                SchemaObjectType.CHECK,
                sourceTable,
                "CHECK-constraints отличаются по тексту; требуется ручной review",
                sourceValue,
                targetValue));
        }
    }

    private SchemaIssue issue(SchemaIssueSeverity severity, SchemaObjectType objectType,
                              String objectName, String message, String sourceValue, String targetValue) {
        return SchemaIssue.builder()
            .severity(severity)
            .objectType(objectType)
            .objectName(objectName)
            .message(message)
            .sourceValue(sourceValue)
            .targetValue(targetValue)
            .build();
    }

    private int count(List<SchemaIssue> issues, SchemaIssueSeverity severity) {
        return (int) issues.stream()
            .filter(issue -> issue.getSeverity() == severity)
            .count();
    }

    private boolean sameColumns(List<String> source, List<String> target) {
        return normalizeColumns(source).equals(normalizeColumns(target));
    }

    private Set<String> normalizeColumns(List<String> columns) {
        return columns.stream()
            .map(column -> column.toLowerCase(Locale.ROOT))
            .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private String columns(List<String> columns) {
        return String.join(", ", columns);
    }

    private String foreignKeyKey(ForeignKeyMetadata key) {
        return columns(key.columns()).toLowerCase(Locale.ROOT)
            + "->" + key.referencedTable().toLowerCase(Locale.ROOT)
            + "(" + columns(key.referencedColumns()).toLowerCase(Locale.ROOT) + ")";
    }

    private String describeForeignKey(ForeignKeyMetadata key) {
        return columns(key.columns()) + " -> " + key.referencedTable()
            + "(" + columns(key.referencedColumns()) + ")"
            + " [ON UPDATE " + key.updateRule() + ", ON DELETE " + key.deleteRule() + "]";
    }

    private String indexKey(IndexMetadata index) {
        return (index.unique() ? "UNIQUE:" : "INDEX:")
            + index.columns().stream()
            .map(column -> column.toLowerCase(Locale.ROOT))
            .collect(Collectors.joining(","));
    }

    private String normalizeDefault(String value) {
        if (value == null) {
            return null;
        }

        return value.toLowerCase(Locale.ROOT)
            .replace("localtimestamp", "current_timestamp")
            .replace("sysdate", "current_timestamp")
            .replace("::character varying", "")
            .replace("::text", "")
            .replace("false", "0")
            .replace("true", "1")
            .replace("\"", "")
            .replace("'", "")
            .replaceAll("[\\s()]", "");
    }

    private String normalizeCheck(String expression) {
        if (expression == null) {
            return "";
        }

        return expression.toLowerCase(Locale.ROOT)
            .replaceAll("[\\s()'\"`]", "")
            .replace("::charactervarying", "")
            .replace("::text", "");
    }

    /**
     * Oracle хранит NOT NULL как CHECK вида {@code "COLUMN" IS NOT NULL}.
     * Это уже проверяется через nullable колонки, поэтому в CHECK-diff не включается.
     */
    private boolean isNotNullCheck(CheckConstraintMetadata check) {
        String expression = check.expression();

        if (expression == null) {
            return false;
        }

        return expression.toLowerCase(Locale.ROOT)
            .replace("\"", "")
            .replace(" ", "")
            .endsWith("isnotnull");
    }

    private String checks(List<CheckConstraintMetadata> checks) {
        return checks.stream()
            .map(check -> check.name() + ": " + check.expression())
            .collect(Collectors.joining("; "));
    }

    private String describeColumn(ColumnMetadata column) {
        return column.typeName() + "(" + column.size() + "," + column.decimalDigits() + ")"
            + (column.nullable() ? " NULL" : " NOT NULL")
            + (column.defaultValue() == null ? "" : " DEFAULT " + column.defaultValue());
    }

    private String displaySchema(String schema) {
        return schema == null || schema.isBlank() ? "(current)" : schema;
    }
}

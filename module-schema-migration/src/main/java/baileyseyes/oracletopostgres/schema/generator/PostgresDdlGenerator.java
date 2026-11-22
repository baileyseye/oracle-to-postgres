package baileyseyes.oracletopostgres.schema.generator;

import baileyseyes.oracletopostgres.schema.dto.SchemaDdlStatement;
import baileyseyes.oracletopostgres.schema.dto.SchemaMigrationPlan;
import baileyseyes.oracletopostgres.schema.model.OracleCheck;
import baileyseyes.oracletopostgres.schema.model.OracleColumn;
import baileyseyes.oracletopostgres.schema.model.OracleForeignKey;
import baileyseyes.oracletopostgres.schema.model.OracleIndex;
import baileyseyes.oracletopostgres.schema.model.OracleSchema;
import baileyseyes.oracletopostgres.schema.model.OracleSequence;
import baileyseyes.oracletopostgres.schema.model.OracleTable;
import baileyseyes.oracletopostgres.schema.target.service.PostgresTargetSnapshot;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * Генератор PostgreSQL DDL по снимку Oracle-схемы.
 * <br>
 * Для отсутствующих таблиц генерируется полный CREATE TABLE с PK/unique/check,
 * затем FK, индексы и комментарии. Для уже существующих таблиц добавляются только
 * отсутствующие колонки (nullable) и предупреждение о ручном review drift.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PostgresDdlGenerator {

    private static final String MAPPING_TABLE = "migration_entity_map";

    private final PostgresTypeMapper typeMapper;

    public SchemaMigrationPlan generate(OracleSchema source, PostgresTargetSnapshot target) {
        String targetSchema = target.schema();
        List<SchemaDdlStatement> statements = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        Set<String> usedNames = new HashSet<>();
        Set<String> existingTables = target.tables();
        Set<String> newTables = new LinkedHashSet<>();

        add(statements, "SCHEMA", "SCHEMA", targetSchema,
            "CREATE SCHEMA IF NOT EXISTS " + quote(targetSchema));

        for (OracleSequence sequence : source.sequences()) {
            add(statements, "SEQUENCE", "SEQUENCE", sequence.name(),
                "CREATE SEQUENCE IF NOT EXISTS " + quote(targetSchema) + "." + quote(name(sequence.name()))
                    + " START WITH " + Math.max(sequence.startWith(), 1)
                    + " INCREMENT BY " + sequence.incrementBy());
        }

        addMappingTable(statements, targetSchema);

        for (OracleTable table : source.tables()) {
            String targetTable = table.name().toLowerCase(Locale.ROOT);

            if (!existingTables.contains(targetTable)) {
                newTables.add(targetTable);
                add(statements, "TABLE", "TABLE", table.name(), createTable(targetSchema, table, usedNames, warnings));
            } else {
                addMissingColumns(statements, targetSchema, table, target.columns().getOrDefault(targetTable, Set.of()),
                    warnings);
            }
        }

        for (OracleTable table : source.tables()) {
            String targetTable = table.name().toLowerCase(Locale.ROOT);

            if (!newTables.contains(targetTable)) {
                continue;
            }

            for (OracleForeignKey key : table.foreignKeys()) {
                add(statements, "FOREIGN_KEY", "FOREIGN_KEY", key.name(),
                    foreignKey(targetSchema, table, key, usedNames));
            }

            for (OracleIndex index : table.indexes()) {
                if (!index.unique()) {
                    add(statements, "INDEX", "INDEX", index.name(),
                        index(targetSchema, table, index, usedNames));
                }
            }
        }

        for (OracleTable table : source.tables()) {
            addComments(statements, targetSchema, table);
        }

        for (var unsupported : source.unsupportedObjects()) {
            warnings.add("Не переносится автоматически: " + unsupported.type() + " (" + unsupported.count() + ")");
        }

        log.info("Сгенерирован DDL: source={}, target={}, tables={}, statements={}, newTables={}",
            source.schema(), targetSchema, source.tables().size(), statements.size(), newTables.size());

        return SchemaMigrationPlan.builder()
            .sourceSchema(source.schema())
            .targetSchema(targetSchema)
            .targetEmpty(existingTables.isEmpty())
            .tables(source.tables().size())
            .statements(statements.size())
            .ddl(statements)
            .warnings(warnings)
            .unsupportedObjects(source.unsupportedObjects())
            .build();
    }

    private String createTable(String schema, OracleTable table, Set<String> usedNames,
                               List<String> warnings) {
        List<String> definitions = new ArrayList<>();

        for (OracleColumn column : table.columns()) {
            PostgresTypeMapper.MappedType mapped = typeMapper.map(column);

            if (mapped.warning() != null) {
                warnings.add(mapped.warning());
            }

            StringBuilder definition = new StringBuilder()
                .append(quote(column.name().toLowerCase(Locale.ROOT)))
                .append(' ')
                .append(mapped.targetType());

            String defaultClause = typeMapper.defaultClause(column, mapped, warnings);

            if (defaultClause != null) {
                definition.append(" DEFAULT ").append(defaultClause);
            }

            if (!column.nullable() || mapped.identity()) {
                definition.append(" NOT NULL");
            }

            definitions.add(definition.toString());
        }

        Set<String> primaryKey = normalize(table.primaryKey());

        if (!primaryKey.isEmpty()) {
            definitions.add("CONSTRAINT " + quote(uniqueName(usedNames, "pk_" + table.name()))
                + " PRIMARY KEY (" + columns(table.primaryKey()) + ")");
        }

        Set<String> uniqueKeys = new LinkedHashSet<>();

        for (OracleIndex index : table.indexes()) {
            if (!index.unique()) {
                continue;
            }

            Set<String> indexColumns = normalize(index.columns());

            if (indexColumns.equals(primaryKey) || !uniqueKeys.add(indexColumns.toString())) {
                continue;
            }

            String name = uniqueName(usedNames, "uk_" + table.name() + "_" + joined(index.columns()));
            definitions.add("CONSTRAINT " + quote(name)
                + " UNIQUE (" + columns(index.columns()) + ")");
        }

        int checkIndex = 0;

        for (OracleCheck check : table.checks()) {
            if (isNotNullCheck(check.expression()) || !isSupportedCheck(check.expression(), warnings, table.name())) {
                continue;
            }

            checkIndex++;
            String name = uniqueName(usedNames, "ck_" + table.name() + "_" + checkIndex);
            definitions.add("CONSTRAINT " + quote(name)
                + " CHECK (" + check.expression() + ")");
        }

        return "CREATE TABLE IF NOT EXISTS " + quote(schema) + "." + quote(table.name().toLowerCase(Locale.ROOT))
            + " (\n  " + String.join(",\n  ", definitions) + "\n)";
    }

    private void addMissingColumns(List<SchemaDdlStatement> statements, String schema, OracleTable table,
                                   Set<String> targetColumns, List<String> warnings) {
        for (OracleColumn column : table.columns()) {
            if (targetColumns.contains(column.name().toLowerCase(Locale.ROOT))) {
                continue;
            }

            PostgresTypeMapper.MappedType mapped = typeMapper.map(column);

            if (mapped.warning() != null) {
                warnings.add(mapped.warning());
            }

            StringBuilder sql = new StringBuilder("ALTER TABLE ")
                .append(quote(schema)).append('.').append(quote(table.name().toLowerCase(Locale.ROOT)))
                .append(" ADD COLUMN IF NOT EXISTS ")
                .append(quote(column.name().toLowerCase(Locale.ROOT)))
                .append(' ')
                .append(mapped.targetType());

            String defaultClause = typeMapper.defaultClause(column, mapped, warnings);

            if (defaultClause != null) {
                sql.append(" DEFAULT ").append(defaultClause);
            }

            add(statements, "ALTER_TABLE", "COLUMN", column.name(), sql.toString());
            warnings.add("В существующую таблицу " + table.name() + " добавлена nullable-колонка "
                + column.name() + "; типы и constraints требуют ручного review");
        }
    }

    private String foreignKey(String schema, OracleTable table, OracleForeignKey key,
                              Set<String> usedNames) {
        String name = uniqueName(usedNames, "fk_" + table.name() + "_" + joined(key.columns()));

        return "ALTER TABLE " + quote(schema) + "." + quote(table.name().toLowerCase(Locale.ROOT))
            + " ADD CONSTRAINT " + quote(name)
            + " FOREIGN KEY (" + columns(key.columns()) + ")"
            + " REFERENCES " + quote(schema) + "." + quote(key.referencedTable().toLowerCase(Locale.ROOT))
            + " (" + columns(key.referencedColumns()) + ")"
            + " ON UPDATE " + key.updateRule()
            + " ON DELETE " + key.deleteRule();
    }

    private String index(String schema, OracleTable table, OracleIndex index, Set<String> usedNames) {
        String name = uniqueName(usedNames, "idx_" + table.name() + "_" + joined(index.columns()));

        return "CREATE INDEX IF NOT EXISTS " + quote(name)
            + " ON " + quote(schema) + "." + quote(table.name().toLowerCase(Locale.ROOT))
            + " (" + columns(index.columns()) + ")";
    }

    private void addComments(List<SchemaDdlStatement> statements, String schema, OracleTable table) {
        String tableName = table.name().toLowerCase(Locale.ROOT);

        if (table.comment() != null && !table.comment().isBlank()) {
            add(statements, "COMMENT", "TABLE", table.name(),
                "COMMENT ON TABLE " + quote(schema) + "." + quote(tableName)
                    + " IS " + literal(table.comment()));
        }

        for (Map.Entry<String, String> entry : table.columnComments().entrySet()) {
            add(statements, "COMMENT", "COLUMN", entry.getKey(),
                "COMMENT ON COLUMN " + quote(schema) + "." + quote(tableName)
                    + "." + quote(entry.getKey().toLowerCase(Locale.ROOT))
                    + " IS " + literal(entry.getValue()));
        }
    }

    private void addMappingTable(List<SchemaDdlStatement> statements, String schema) {
        String sql = "CREATE TABLE IF NOT EXISTS " + quote(schema) + "." + quote(MAPPING_TABLE) + " (\n"
            + "  entity_type VARCHAR(20) NOT NULL\n"
            + "  ,source_id BIGINT NOT NULL\n"
            + "  ,target_id BIGINT NOT NULL\n"
            + "  ,source_key VARCHAR(255) NOT NULL\n"
            + "  ,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL\n"
            + "  ,CONSTRAINT pk_migration_entity_map PRIMARY KEY (entity_type, source_id)\n"
            + "  ,CONSTRAINT uk_migration_entity_map_target UNIQUE (entity_type, target_id)\n"
            + "  ,CONSTRAINT ck_migration_entity_map_type CHECK (entity_type IN ('USER', 'ORDER'))\n"
            + ")";
        add(statements, "SERVICE_TABLE", "TABLE", MAPPING_TABLE, sql);
    }

    private boolean isSupportedCheck(String expression, List<String> warnings, String table) {
        if (expression == null) {
            return false;
        }

        String upper = expression.toUpperCase(Locale.ROOT);

        if (upper.contains("NVL(") || upper.contains("DECODE(") || upper.contains("SYSDATE")
            || upper.contains("TO_DATE(") || upper.contains("TO_TIMESTAMP(")) {
            warnings.add("CHECK-constraint таблицы " + table + " требует ручного преобразования: " + expression);
            return false;
        }

        return true;
    }

    private boolean isNotNullCheck(String expression) {
        if (expression == null) {
            return false;
        }

        return expression.toLowerCase(Locale.ROOT)
            .replace("\"", "")
            .replace(" ", "")
            .endsWith("isnotnull");
    }

    private void add(List<SchemaDdlStatement> statements, String phase, String objectType,
                     String objectName, String sql) {
        statements.add(new SchemaDdlStatement(phase, objectType, objectName, sql));
    }

    private Set<String> normalize(List<String> columns) {
        return columns.stream()
            .map(column -> column.toLowerCase(Locale.ROOT))
            .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private String columns(List<String> columns) {
        return columns.stream()
            .map(column -> quote(column.toLowerCase(Locale.ROOT)))
            .collect(Collectors.joining(", "));
    }

    private String joined(List<String> columns) {
        return columns.stream()
            .map(column -> column.toLowerCase(Locale.ROOT))
            .collect(Collectors.joining("_"));
    }

    private String uniqueName(Set<String> used, String candidate) {
        String base = name(candidate);
        String result = base;
        int suffix = 2;

        while (!used.add(result)) {
            result = name(base + "_" + suffix);
            suffix++;
        }

        return result;
    }

    private String name(String value) {
        String normalized = value.toLowerCase(Locale.ROOT)
            .replaceAll("[^a-z0-9_]+", "_")
            .replaceAll("_+", "_")
            .replaceAll("^_|_$", "");

        if (normalized.isBlank()) {
            normalized = "object";
        }

        if (Character.isDigit(normalized.charAt(0))) {
            normalized = "o_" + normalized;
        }

        return normalized.length() <= 60 ? normalized : normalized.substring(0, 60);
    }

    private String quote(String identifier) {
        return "\"" + identifier.replace("\"", "\"\"") + "\"";
    }

    private String literal(String value) {
        return "'" + value.replace("'", "''") + "'";
    }
}

package baileyseyes.oracletopostgres.schema.service;

import baileyseyes.oracletopostgres.schema.dto.SchemaMigrationPlan;
import baileyseyes.oracletopostgres.schema.dto.SchemaMigrationReport;
import baileyseyes.oracletopostgres.schema.dto.SchemaMigrationStatus;
import baileyseyes.oracletopostgres.schema.dto.TableSchemaStatus;
import baileyseyes.oracletopostgres.schema.generator.PostgresDdlGenerator;
import baileyseyes.oracletopostgres.schema.model.OracleSchema;
import baileyseyes.oracletopostgres.schema.model.OracleTable;
import baileyseyes.oracletopostgres.schema.source.oracle.OracleSchemaReader;
import baileyseyes.oracletopostgres.schema.target.service.PostgresSchemaApplier;
import baileyseyes.oracletopostgres.schema.target.service.PostgresTargetInspector;
import baileyseyes.oracletopostgres.schema.target.service.PostgresTargetSnapshot;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class SchemaMigrationService {

    private final OracleSchemaReader sourceReader;
    private final PostgresTargetInspector targetInspector;
    private final PostgresDdlGenerator ddlGenerator;
    private final PostgresSchemaApplier schemaApplier;

    public SchemaMigrationPlan preview() {
        OracleSchema source = sourceReader.readSchema();
        PostgresTargetSnapshot target = targetInspector.snapshot();
        return ddlGenerator.generate(source, target);
    }

    public SchemaMigrationReport apply() {
        LocalDateTime startedAt = LocalDateTime.now();
        SchemaMigrationPlan plan = preview();
        int applied = schemaApplier.apply(plan.getDdl());
        LocalDateTime finishedAt = LocalDateTime.now();

        SchemaMigrationReport report = SchemaMigrationReport.builder()
            .sourceSchema(plan.getSourceSchema())
            .targetSchema(plan.getTargetSchema())
            .startedAt(startedAt)
            .finishedAt(finishedAt)
            .appliedStatements(applied)
            .totalStatements(plan.getStatements())
            .success(true)
            .warnings(plan.getWarnings())
            .build();

        log.info("Schema migration завершена: target={}, statements={}, warnings={}",
            plan.getTargetSchema(), applied, plan.getWarnings().size());

        return report;
    }

    public SchemaMigrationStatus status() {
        OracleSchema source = sourceReader.readSchema();
        PostgresTargetSnapshot target = targetInspector.snapshot();
        Set<String> targetTables = target.tables();
        List<TableSchemaStatus> tables = new ArrayList<>();
        int missingTables = 0;
        int missingColumns = 0;

        for (OracleTable table : source.tables()) {
            String targetName = table.name().toLowerCase(Locale.ROOT);
            Set<String> targetColumns = target.columns().getOrDefault(targetName, Set.of());

            if (!targetTables.contains(targetName)) {
                missingTables++;
                tables.add(new TableSchemaStatus(table.name(), false, List.of()));
                continue;
            }

            List<String> columns = table.columns().stream()
                .map(column -> column.name().toLowerCase(Locale.ROOT))
                .filter(column -> !targetColumns.contains(column))
                .toList();

            missingColumns += columns.size();
            tables.add(new TableSchemaStatus(table.name(), true, columns));
        }

        return SchemaMigrationStatus.builder()
            .sourceSchema(source.schema())
            .targetSchema(target.schema())
            .targetExists(!targetTables.isEmpty())
            .sourceTables(source.tables().size())
            .targetTables(targetTables.size())
            .missingTables(missingTables)
            .missingColumns(missingColumns)
            .valid(missingTables == 0 && missingColumns == 0)
            .tables(tables)
            .unsupportedObjects(source.unsupportedObjects())
            .build();
    }
}

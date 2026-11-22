package baileyseyes.oracletopostgres.migration.controller;

import static org.springframework.http.ResponseEntity.ok;

import baileyseyes.oracletopostgres.migration.dto.MigrationJobResponse;
import baileyseyes.oracletopostgres.migration.dto.MigrationReport;
import baileyseyes.oracletopostgres.migration.dto.MigrationStatus;
import baileyseyes.oracletopostgres.migration.dto.SchemaDiffReport;
import baileyseyes.oracletopostgres.migration.service.MigrationJobManager;
import baileyseyes.oracletopostgres.migration.service.MigrationRunService;
import baileyseyes.oracletopostgres.migration.service.MigrationStatisticsService;
import baileyseyes.oracletopostgres.migration.service.SchemaDiffService;
import baileyseyes.oracletopostgres.migration.source.service.MigrationSourceService;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/migration")
@RequiredArgsConstructor
public class MigrationController {

    private final MigrationSourceService migrationSourceService;
    private final MigrationRunService migrationRunService;
    private final MigrationJobManager migrationJobManager;
    private final MigrationStatisticsService migrationStatisticsService;
    private final SchemaDiffService schemaDiffService;

    /**
     * GET {@code http://localhost:8083/api/v1/migration/tables}
     * <br>
     * Пример: {@code http://localhost:8083/api/v1/migration/tables}
     */
    @GetMapping("/tables")
    public ResponseEntity<List<String>> listTables() {
        return ok(migrationSourceService.listTables());
    }

    /**
     * GET {@code http://localhost:8083/api/v1/migration/tables/{tableName}/columns}
     * <br>
     * Пример: {@code http://localhost:8083/api/v1/migration/tables/insurance_program_users/columns}
     */
    @GetMapping("/tables/{tableName}/columns")
    public ResponseEntity<List<String>> listColumns(@PathVariable String tableName) {
        return ok(migrationSourceService.listColumns(tableName));
    }

    /**
     * GET {@code http://localhost:8083/api/v1/migration/tables/{tableName}/rows}
     * <br>
     * Пример: {@code http://localhost:8083/api/v1/migration/tables/insurance_program_users/rows}
     */
    @GetMapping("/tables/{tableName}/rows")
    public ResponseEntity<List<Map<String, Object>>> readRows(@PathVariable String tableName) {
        return ok(migrationSourceService.readRows(tableName));
    }

    /**
     * GET {@code http://localhost:8083/api/v1/migration/schema/diff}
     * <br>
     * Сравнивает таблицы, колонки и индексы источника и приёмника.
     */
    @GetMapping("/schema/diff")
    public ResponseEntity<SchemaDiffReport> diffSchema() {
        return ok(schemaDiffService.diff());
    }

    /**
     * POST {@code http://localhost:8083/api/v1/migration/run}
     * <br>
     * Режим задаётся {@code migration.mode} / env {@code MIGRATION_MODE}:
     * {@code mirror} — зеркальная синхронизация,
     * {@code initial-load} — быстрая загрузка на время остановки окружения.
     */
    @PostMapping("/run")
    public ResponseEntity<MigrationReport> runMigration() {
        return ok(migrationRunService.run());
    }

    /**
     * POST {@code http://localhost:8083/api/v1/migration/run/async}
     * <br>
     * Запускает миграцию в фоне и возвращает {@code 202 + jobId}.
     */
    @PostMapping("/run/async")
    public ResponseEntity<MigrationJobResponse> runMigrationAsync() {
        return ResponseEntity.accepted().body(migrationJobManager.start());
    }

    /**
     * GET {@code http://localhost:8083/api/v1/migration/run/{jobId}}
     * <br>
     * Возвращает статус, progress и итоговый отчёт job.
     */
    @GetMapping("/run/{jobId}")
    public ResponseEntity<MigrationJobResponse> getMigrationJob(@PathVariable String jobId) {
        return ok(migrationJobManager.get(jobId));
    }

    /**
     * POST {@code http://localhost:8083/api/v1/migration/run/{jobId}/cancel}
     * <br>
     * Запрашивает отмену initial-load между чанками.
     */
    @PostMapping("/run/{jobId}/cancel")
    public ResponseEntity<MigrationJobResponse> cancelMigrationJob(@PathVariable String jobId) {
        return ok(migrationJobManager.cancel(jobId));
    }

    /**
     * GET {@code http://localhost:8083/api/v1/migration/status}
     * <br>
     * Пример: {@code http://localhost:8083/api/v1/migration/status}
     */
    @GetMapping("/status")
    public ResponseEntity<MigrationStatus> getStatus() {
        return ok(migrationStatisticsService.getStatus());
    }
}

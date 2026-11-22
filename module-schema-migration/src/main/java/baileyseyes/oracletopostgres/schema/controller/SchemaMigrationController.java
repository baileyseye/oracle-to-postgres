package baileyseyes.oracletopostgres.schema.controller;

import static org.springframework.http.ResponseEntity.ok;

import baileyseyes.oracletopostgres.schema.dto.SchemaMigrationPlan;
import baileyseyes.oracletopostgres.schema.dto.SchemaMigrationReport;
import baileyseyes.oracletopostgres.schema.dto.SchemaMigrationStatus;
import baileyseyes.oracletopostgres.schema.service.SchemaMigrationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/schema-migration")
@RequiredArgsConstructor
public class SchemaMigrationController {

    private final SchemaMigrationService schemaMigrationService;

    /**
     * GET {@code http://localhost:8084/api/v1/schema-migration/preview}
     * <br>
     * Показывает DDL, который будет применён к target-схеме.
     */
    @GetMapping("/preview")
    public ResponseEntity<SchemaMigrationPlan> preview() {
        return ok(schemaMigrationService.preview());
    }

    /**
     * POST {@code http://localhost:8084/api/v1/schema-migration/apply}
     * <br>
     * Применяет DDL к target-схеме.
     */
    @PostMapping("/apply")
    public ResponseEntity<SchemaMigrationReport> apply() {
        return ok(schemaMigrationService.apply());
    }

    /**
     * GET {@code http://localhost:8084/api/v1/schema-migration/status}
     * <br>
     * Показывает, какие таблицы/колонки уже есть в target.
     */
    @GetMapping("/status")
    public ResponseEntity<SchemaMigrationStatus> status() {
        return ok(schemaMigrationService.status());
    }
}

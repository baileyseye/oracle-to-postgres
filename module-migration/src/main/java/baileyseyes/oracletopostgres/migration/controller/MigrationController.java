package baileyseyes.oracletopostgres.migration.controller;

import static org.springframework.http.ResponseEntity.ok;

import baileyseyes.oracletopostgres.migration.source.service.MigrationSourceService;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/migration")
@RequiredArgsConstructor
public class MigrationController {

    private final MigrationSourceService migrationSourceService;

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
}

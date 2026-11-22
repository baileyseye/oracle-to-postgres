package baileyseyes.oracletopostgres.migration.dto;

import java.util.List;

/**
 * Итог validation initial-load.
 */
public record MigrationValidationReport(boolean valid, List<ValidationCheck> checks) {

    public MigrationValidationReport {
        checks = List.copyOf(checks);
    }
}

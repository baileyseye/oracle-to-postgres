package baileyseyes.oracletopostgres.migration.common.exception;

import baileyseyes.oracletopostgres.migration.dto.MigrationReport;
import java.io.Serial;

/**
 * Validation initial-load не прошла; target нельзя открывать приложению.
 */
public class MigrationValidationException extends MigrationException {

    @Serial
    private static final long serialVersionUID = 1L;

    private final transient MigrationReport report;

    public MigrationValidationException(String message, MigrationReport report) {
        super(message);
        this.report = report;
    }

    public MigrationReport getReport() {
        return report;
    }
}

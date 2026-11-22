package baileyseyes.oracletopostgres.migration.common.exception;

import java.io.Serial;

/**
 * Асинхронный job миграции отменён между чанками.
 */
public class MigrationCancelledException extends MigrationException {

    @Serial
    private static final long serialVersionUID = 1L;

    public MigrationCancelledException(String jobId) {
        super("Job миграции отменён: " + jobId);
    }
}

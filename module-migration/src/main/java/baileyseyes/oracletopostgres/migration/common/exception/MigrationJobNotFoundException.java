package baileyseyes.oracletopostgres.migration.common.exception;

import java.io.Serial;

/**
 * Асинхронный job миграции не найден.
 */
public class MigrationJobNotFoundException extends MigrationException {

    @Serial
    private static final long serialVersionUID = 1L;

    public MigrationJobNotFoundException(String jobId) {
        super("Job миграции не найден: " + jobId);
    }
}

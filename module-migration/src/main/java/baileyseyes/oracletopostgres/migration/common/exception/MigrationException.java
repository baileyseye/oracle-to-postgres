package baileyseyes.oracletopostgres.migration.common.exception;

import java.io.Serial;

/**
 * Базовое исключение прикладных ошибок сервиса миграции.
 */
public class MigrationException extends RuntimeException {

    @Serial
    private static final long serialVersionUID = 1L;

    public MigrationException(String message) {
        super(message);
    }

    public MigrationException(String message, Throwable cause) {
        super(message, cause);
    }
}

package baileyseyes.oracletopostgres.migration.common.exception;

import java.io.Serial;

/**
 * Не удалось подключиться к PostgreSQL-приёмнику или выполнить запись.
 */
public class TargetAccessException extends MigrationException {

    @Serial
    private static final long serialVersionUID = 1L;

    public TargetAccessException(String message) {
        super(message);
    }

    public TargetAccessException(String message, Throwable cause) {
        super(message, cause);
    }
}

package baileyseyes.oracletopostgres.migration.common.exception;

import java.io.Serial;

/**
 * Переносимые данные конфликтуют с ограничениями PostgreSQL-приёмника.
 */
public class MigrationConflictException extends MigrationException {

    @Serial
    private static final long serialVersionUID = 1L;

    public MigrationConflictException(String message) {
        super(message);
    }

    public MigrationConflictException(String message, Throwable cause) {
        super(message, cause);
    }
}

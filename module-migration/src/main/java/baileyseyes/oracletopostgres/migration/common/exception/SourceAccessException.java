package baileyseyes.oracletopostgres.migration.common.exception;

import java.io.Serial;

/**
 * Не удалось получить метаданные или прочитать данные источника.
 */
public class SourceAccessException extends MigrationException {

    @Serial
    private static final long serialVersionUID = 1L;

    public SourceAccessException(String message) {
        super(message);
    }

    public SourceAccessException(String message, Throwable cause) {
        super(message, cause);
    }
}

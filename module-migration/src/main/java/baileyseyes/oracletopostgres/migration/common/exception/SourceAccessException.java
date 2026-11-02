package baileyseyes.oracletopostgres.migration.common.exception;

/**
 * Не удалось получить метаданные или прочитать данные источника.
 */
public class SourceAccessException extends MigrationException {

    public SourceAccessException(String message, Throwable cause) {
        super(message, cause);
    }
}

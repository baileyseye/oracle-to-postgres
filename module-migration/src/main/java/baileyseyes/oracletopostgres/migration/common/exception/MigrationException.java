package baileyseyes.oracletopostgres.migration.common.exception;

/**
 * Базовое исключение прикладных ошибок сервиса миграции.
 */
public class MigrationException extends RuntimeException {

    public MigrationException(String message) {
        super(message);
    }

    public MigrationException(String message, Throwable cause) {
        super(message, cause);
    }
}

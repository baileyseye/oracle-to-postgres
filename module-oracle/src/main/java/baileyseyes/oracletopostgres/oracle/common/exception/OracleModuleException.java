package baileyseyes.oracletopostgres.oracle.common.exception;

/**
 * Базовое исключение прикладных ошибок Oracle-модуля.
 */
public class OracleModuleException extends RuntimeException {

    public OracleModuleException(String message) {
        super(message);
    }
}

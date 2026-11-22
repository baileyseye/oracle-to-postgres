package baileyseyes.oracletopostgres.oracle.common.exception;

import java.io.Serial;

/**
 * Базовое исключение прикладных ошибок Oracle-модуля.
 */
public class OracleModuleException extends RuntimeException {

    @Serial
    private static final long serialVersionUID = 1L;

    public OracleModuleException(String message) {
        super(message);
    }
}

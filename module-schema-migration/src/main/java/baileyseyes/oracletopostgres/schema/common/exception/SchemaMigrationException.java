package baileyseyes.oracletopostgres.schema.common.exception;

import java.io.Serial;

public class SchemaMigrationException extends RuntimeException {

    @Serial
    private static final long serialVersionUID = 1L;

    public SchemaMigrationException(String message) {
        super(message);
    }

    public SchemaMigrationException(String message, Throwable cause) {
        super(message, cause);
    }
}

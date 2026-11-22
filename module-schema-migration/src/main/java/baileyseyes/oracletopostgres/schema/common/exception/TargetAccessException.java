package baileyseyes.oracletopostgres.schema.common.exception;

import java.io.Serial;

public class TargetAccessException extends SchemaMigrationException {

    @Serial
    private static final long serialVersionUID = 1L;

    public TargetAccessException(String message) {
        super(message);
    }

    public TargetAccessException(String message, Throwable cause) {
        super(message, cause);
    }
}

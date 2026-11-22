package baileyseyes.oracletopostgres.schema.common.exception;

import java.io.Serial;

public class SourceAccessException extends SchemaMigrationException {

    @Serial
    private static final long serialVersionUID = 1L;

    public SourceAccessException(String message, Throwable cause) {
        super(message, cause);
    }
}

package baileyseyes.oracletopostgres.oracle.common.exception;

import java.io.Serial;

/**
 * Сигнализирует, что пользователь с запрошенным идентификатором отсутствует в Oracle.
 */
public class UserNotFoundException extends OracleModuleException {

    @Serial
    private static final long serialVersionUID = 1L;

    public UserNotFoundException(Long id) {
        super("Пользователь с идентификатором " + id + " не найден");
    }
}

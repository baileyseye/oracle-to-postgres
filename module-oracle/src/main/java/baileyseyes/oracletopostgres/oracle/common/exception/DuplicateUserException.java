package baileyseyes.oracletopostgres.oracle.common.exception;

import java.io.Serial;

/**
 * Нарушение уникальности логина или email при сохранении пользователя.
 */
public class DuplicateUserException extends OracleModuleException {

    @Serial
    private static final long serialVersionUID = 1L;

    public DuplicateUserException(String field, String value) {
        super("Пользователь с " + field + " = '" + value + "' уже существует");
    }
}

package baileyseyes.oracletopostgres.oracle.common.exception;

/**
 * Нарушение уникальности логина или email при сохранении пользователя.
 */
public class DuplicateUserException extends OracleModuleException {

    public DuplicateUserException(String field, String value) {
        super("Пользователь с " + field + " = '" + value + "' уже существует");
    }
}

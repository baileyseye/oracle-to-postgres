package baileyseyes.oracletopostgres.oracle.common.exception;

/**
 * Сигнализирует, что пользователь с запрошенным идентификатором отсутствует в Oracle.
 */
public class UserNotFoundException extends OracleModuleException {

    public UserNotFoundException(Long id) {
        super("Пользователь с идентификатором " + id + " не найден");
    }
}

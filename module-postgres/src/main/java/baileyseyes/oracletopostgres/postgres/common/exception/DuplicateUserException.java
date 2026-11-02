package baileyseyes.oracletopostgres.postgres.common.exception;

/**
 * Нарушение уникальности логина или email при сохранении пользователя.
 */
public class DuplicateUserException extends PostgresModuleException {

  public DuplicateUserException(String field, String value) {
    super("Пользователь с " + field + " = '" + value + "' уже существует");
  }
}

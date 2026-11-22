package baileyseyes.oracletopostgres.postgres.common.exception;

import java.io.Serial;

/**
 * Нарушение уникальности логина или email при сохранении пользователя.
 */
public class DuplicateUserException extends PostgresModuleException {

  @Serial
  private static final long serialVersionUID = 1L;

  public DuplicateUserException(String field, String value) {
    super("Пользователь с " + field + " = '" + value + "' уже существует");
  }
}

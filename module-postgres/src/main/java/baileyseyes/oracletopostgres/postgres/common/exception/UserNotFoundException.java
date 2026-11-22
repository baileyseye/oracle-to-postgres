package baileyseyes.oracletopostgres.postgres.common.exception;

import java.io.Serial;

/**
 * Сигнализирует, что пользователь с запрошенным идентификатором отсутствует в PostgreSQL.
 */
public class UserNotFoundException extends PostgresModuleException {

  @Serial
  private static final long serialVersionUID = 1L;

  public UserNotFoundException(Long id) {
    super("Пользователь с идентификатором " + id + " не найден");
  }
}

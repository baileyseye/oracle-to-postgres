package baileyseyes.oracletopostgres.postgres.common.exception;

/**
 * Сигнализирует, что пользователь с запрошенным идентификатором отсутствует в PostgreSQL.
 */
public class UserNotFoundException extends PostgresModuleException {

  public UserNotFoundException(Long id) {
    super("Пользователь с идентификатором " + id + " не найден");
  }
}

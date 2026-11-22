package baileyseyes.oracletopostgres.postgres.common.exception;

import java.io.Serial;

/**
 * Базовое исключение прикладных ошибок PostgreSQL-модуля.
 */
public class PostgresModuleException extends RuntimeException {

  @Serial
  private static final long serialVersionUID = 1L;

  public PostgresModuleException(String message) {
    super(message);
  }
}

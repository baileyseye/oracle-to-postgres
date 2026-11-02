package baileyseyes.oracletopostgres.postgres.common.exception;

/**
 * Базовое исключение прикладных ошибок PostgreSQL-модуля.
 */
public class PostgresModuleException extends RuntimeException {

  public PostgresModuleException(String message) {
    super(message);
  }
}

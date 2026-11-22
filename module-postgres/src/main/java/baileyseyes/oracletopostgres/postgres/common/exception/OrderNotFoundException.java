package baileyseyes.oracletopostgres.postgres.common.exception;

import java.io.Serial;

/**
 * Сигнализирует, что заказ с запрошенным идентификатором
 * отсутствует в PostgreSQL.
 */
public class OrderNotFoundException extends PostgresModuleException {

    @Serial
    private static final long serialVersionUID = 1L;

    public OrderNotFoundException(Long id) {
        super("Заказ с идентификатором " + id + " не найден");
    }
}

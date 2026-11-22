package baileyseyes.oracletopostgres.oracle.common.exception;

import java.io.Serial;

/**
 * Сигнализирует, что заказ с запрошенным идентификатором
 * отсутствует в Oracle.
 */
public class OrderNotFoundException extends OracleModuleException {

    @Serial
    private static final long serialVersionUID = 1L;

    public OrderNotFoundException(Long id) {
        super("Заказ с идентификатором " + id + " не найден");
    }
}

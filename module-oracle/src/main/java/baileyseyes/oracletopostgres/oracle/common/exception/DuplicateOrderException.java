package baileyseyes.oracletopostgres.oracle.common.exception;

import java.io.Serial;

/**
 * Нарушение уникальности номера заказа при сохранении.
 */
public class DuplicateOrderException extends OracleModuleException {

    @Serial
    private static final long serialVersionUID = 1L;

    public DuplicateOrderException(String orderNumber) {
        super("Заказ с номером '" + orderNumber + "' уже существует");
    }
}

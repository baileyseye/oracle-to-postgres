package baileyseyes.oracletopostgres.postgres.order.entity;

/**
 * Жизненный цикл заказа.
 */
public enum OrderStatus {

    /**
     * Заказ создан, но ещё не оплачен.
     */
    NEW,

    /**
     * Заказ оплачен.
     */
    PAID,

    /**
     * Заказ передан в доставку.
     */
    SHIPPED,

    /**
     * Заказ отменён.
     */
    CANCELLED
}

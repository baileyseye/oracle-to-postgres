package baileyseyes.oracletopostgres.postgres.order.dto;

import static lombok.AccessLevel.PRIVATE;

import baileyseyes.oracletopostgres.postgres.order.entity.OrderStatus;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = PRIVATE)
public class OrderResponseDto {

    /**
     * Суррогатный идентификатор заказа.
     */
    Long id;

    /**
     * Идентификатор пользователя, оформившего заказ.
     */
    Long userId;

    /**
     * Логин пользователя, оформившего заказ.
     */
    String username;

    /**
     * Публичный номер заказа.
     */
    String orderNumber;

    /**
     * Сумма заказа.
     */
    BigDecimal amount;

    /**
     * Текущий статус заказа.
     */
    OrderStatus status;

    /**
     * Момент создания заказа в локальном времени приложения.
     */
    LocalDateTime createdAt;
}

package baileyseyes.oracletopostgres.postgres.order.dto;

import static lombok.AccessLevel.PRIVATE;

import baileyseyes.oracletopostgres.postgres.order.entity.OrderStatus;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

/**
 * Входные данные для создания и обновления заказа.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = PRIVATE)
public class OrderRequestDto {

    /**
     * Идентификатор пользователя, который оформляет заказ.
     */
    @NotNull(message = "Идентификатор пользователя обязателен")
    @Positive(message = "Идентификатор пользователя должен быть положительным")
    Long userId;

    /**
     * Публичный номер заказа, уникальный в пределах системы.
     */
    @NotBlank(message = "Номер заказа обязателен")
    @Size(max = 50, message = "Номер заказа не должен превышать 50 символов")
    String orderNumber;

    /**
     * Сумма заказа в валюте системы.
     */
    @NotNull(message = "Сумма заказа обязательна")
    @DecimalMin(value = "0.00", message = "Сумма заказа не может быть отрицательной")
    @Digits(integer = 10, fraction = 2, message = "Сумма заказа должна содержать не более 10 цифр до и 2 после запятой")
    BigDecimal amount;

    /**
     * Текущий статус обработки заказа.
     */
    @NotNull(message = "Статус заказа обязателен")
    OrderStatus status;
}

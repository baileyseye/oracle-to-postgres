package baileyseyes.oracletopostgres.migration.common.support;

import baileyseyes.oracletopostgres.migration.common.exception.MigrationException;
import baileyseyes.oracletopostgres.migration.service.row.OrderRow;
import baileyseyes.oracletopostgres.migration.service.row.UserRow;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * Преобразование строк Oracle в доменные записи миграции.
 * <br>
 * Лежит вне пакета {@code service..*}, чтобы AOP-логирование
 * не срабатывало на каждой строке: иначе на 100 млн записей
 * логи становятся узким местом.
 */
@Component
public class SourceRowMapper {

    private static final Set<String> ALLOWED_STATUSES = Set.of("NEW", "PAID", "SHIPPED", "CANCELLED");

    public UserRow toUser(Map<String, Object> row) {
        Long sourceId = RowValues.asLong(row, "id");
        String username = RowValues.asString(row, "username");
        String email = RowValues.asString(row, "email");
        LocalDateTime createdAt = RowValues.asLocalDateTime(row, "created_at");
        LocalDateTime updatedAt = RowValues.asLocalDateTime(row, "updated_at");

        requireValue(sourceId, "id", username, "пользователя");
        requireValue(username, "username", username, "пользователя");
        requireValue(email, "email", username, "пользователя");
        requireValue(createdAt, "created_at", username, "пользователя");
        requireValue(updatedAt, "updated_at", username, "пользователя");

        return new UserRow(sourceId, username, email, createdAt, updatedAt);
    }

    public OrderRow toOrder(Map<String, Object> row) {
        Long sourceId = RowValues.asLong(row, "id");
        Long sourceUserId = RowValues.asLong(row, "user_id");
        String orderNumber = RowValues.asString(row, "order_number");
        BigDecimal amount = RowValues.asBigDecimal(row, "amount");
        String status = RowValues.asString(row, "status");
        LocalDateTime createdAt = RowValues.asLocalDateTime(row, "created_at");

        requireValue(sourceId, "id", orderNumber, "заказа");
        requireValue(sourceUserId, "user_id", orderNumber, "заказа");
        requireValue(orderNumber, "order_number", orderNumber, "заказа");
        requireValue(amount, "amount", orderNumber, "заказа");
        requireValue(status, "status", orderNumber, "заказа");
        requireValue(createdAt, "created_at", orderNumber, "заказа");

        if (!ALLOWED_STATUSES.contains(status)) {
            throw new MigrationException("У заказа '" + orderNumber
                + "' недопустимый статус '" + status + "'");
        }

        return new OrderRow(sourceId, sourceUserId, orderNumber, amount, status, createdAt);
    }

    private <T> void requireValue(T value, String field, String key, String entity) {
        if (value == null) {
            throw new MigrationException("У " + entity + " '" + key
                + "' отсутствует обязательное поле " + field);
        }
    }
}

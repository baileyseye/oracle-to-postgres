package baileyseyes.oracletopostgres.migration.service.row;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Одна строка Oracle-таблицы {@code orders}, подготовленная к загрузке в staging.
 * <br>
 * Целевой пользователь здесь ещё не разрешён: source user id → target user id
 * вычисляется в PostgreSQL по {@code migration_entity_map}.
 */
public record OrderRow(long sourceId,
                       long sourceUserId,
                       String orderNumber,
                       BigDecimal amount,
                       String status,
                       LocalDateTime createdAt) {
}

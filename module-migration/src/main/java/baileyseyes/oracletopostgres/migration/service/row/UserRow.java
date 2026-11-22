package baileyseyes.oracletopostgres.migration.service.row;

import java.time.LocalDateTime;

/**
 * Одна строка Oracle-таблицы {@code users}, подготовленная к загрузке в staging.
 * <br>
 * Размер коллекции таких строк ограничен размером чанка,
 * поэтому память не зависит от общего числа записей в источнике.
 */
public record UserRow(long sourceId,
                      String username,
                      String email,
                      LocalDateTime createdAt,
                      LocalDateTime updatedAt) {
}

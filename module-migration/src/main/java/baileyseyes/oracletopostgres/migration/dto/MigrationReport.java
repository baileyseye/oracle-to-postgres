package baileyseyes.oracletopostgres.migration.dto;

import static lombok.AccessLevel.PRIVATE;

import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

/**
 * Итоги одного запуска миграции.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = PRIVATE)
public class MigrationReport {

    /**
     * Момент начала миграции.
     */
    LocalDateTime startedAt;

    /**
     * Момент окончания миграции.
     */
    LocalDateTime finishedAt;

    /**
     * Сколько пользователей прочитано из Oracle.
     */
    long usersRead;

    /**
     * Сколько пользователей добавлено в PostgreSQL.
     */
    long usersInserted;

    /**
     * Сколько пользователей обновлено в PostgreSQL.
     */
    long usersUpdated;

    /**
     * Сколько пользователей удалено из PostgreSQL как отсутствующие в Oracle.
     */
    long usersDeleted;

    /**
     * Сколько заказов прочитано из Oracle.
     */
    long ordersRead;

    /**
     * Сколько заказов добавлено в PostgreSQL.
     */
    long ordersInserted;

    /**
     * Сколько заказов обновлено в PostgreSQL.
     */
    long ordersUpdated;

    /**
     * Сколько заказов удалено из PostgreSQL как отсутствующие в Oracle.
     */
    long ordersDeleted;
}

package baileyseyes.oracletopostgres.migration.dto;

import static lombok.AccessLevel.PRIVATE;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

/**
 * Сравнение количества строк в источнике и приёмнике.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = PRIVATE)
public class MigrationStatus {

    /**
     * Количество пользователей в Oracle.
     */
    long sourceUsers;

    /**
     * Общее количество пользователей в PostgreSQL, включая нативные строки приёмника.
     */
    long targetUsers;

    /**
     * Количество пользователей PostgreSQL, управляемых миграцией.
     */
    long targetManagedUsers;

    /**
     * Количество заказов в Oracle.
     */
    long sourceOrders;

    /**
     * Общее количество заказов в PostgreSQL, включая нативные строки приёмника.
     */
    long targetOrders;

    /**
     * Количество заказов PostgreSQL, управляемых миграцией.
     */
    long targetManagedOrders;
}

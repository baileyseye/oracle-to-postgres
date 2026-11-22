package baileyseyes.oracletopostgres.migration.service;

import baileyseyes.oracletopostgres.migration.dto.MigrationReport;
import baileyseyes.oracletopostgres.migration.service.result.OrderMigrationResult;
import baileyseyes.oracletopostgres.migration.service.result.UserMigrationResult;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Полный сценарий зеркальной миграции: пользователи, затем заказы, затем удаление
 * строк, исчезнувших из источника.
 * <br>
 * Порядок важен из-за внешнего ключа {@code orders.user_id -> users.id}:
 * устаревшие заказы удаляются раньше устаревших пользователей.
 * Транзакция открывается на PostgreSQL-приёмнике, поэтому при ошибке на любом шаге
 * целевые данные откатываются.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MigrationOrchestrationService {

    private final UserMigrationService userMigrationService;
    private final OrderMigrationService orderMigrationService;

    @Transactional(transactionManager = "targetTransactionManager")
    public MigrationReport migrateAll() {
        LocalDateTime startedAt = LocalDateTime.now();

        UserMigrationResult users = userMigrationService.migrate();
        OrderMigrationResult orders = orderMigrationService.migrate(users.userIdMapping());
        long usersDeleted = userMigrationService.deleteStaleUsers(users.staleSourceIds());

        LocalDateTime finishedAt = LocalDateTime.now();

        MigrationReport report = MigrationReport.builder()
            .startedAt(startedAt)
            .finishedAt(finishedAt)
            .usersRead(users.total())
            .usersInserted(users.inserted())
            .usersUpdated(users.updated())
            .usersDeleted(usersDeleted)
            .ordersRead(orders.total())
            .ordersInserted(orders.inserted())
            .ordersUpdated(orders.updated())
            .ordersDeleted(orders.deleted())
            .build();

        log.info("Зеркальная миграция Oracle → PostgreSQL завершена: {}", report);
        return report;
    }
}

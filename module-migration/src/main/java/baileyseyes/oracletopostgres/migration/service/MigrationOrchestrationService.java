package baileyseyes.oracletopostgres.migration.service;

import baileyseyes.oracletopostgres.migration.dto.MigrationReport;
import baileyseyes.oracletopostgres.migration.service.result.OrderMigrationResult;
import baileyseyes.oracletopostgres.migration.service.result.UserMigrationResult;
import baileyseyes.oracletopostgres.migration.target.service.PostgresTargetGateway;
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
    private final PostgresTargetGateway targetGateway;

    @Transactional(transactionManager = "targetTransactionManager")
    public MigrationReport migrateAll() {
        LocalDateTime startedAt = LocalDateTime.now();

        targetGateway.acquireRunLock();
        long runId = targetGateway.currentRunId();

        UserMigrationResult users = userMigrationService.migrate(runId);
        OrderMigrationResult orders = orderMigrationService.migrate(runId);
        long usersDeleted = userMigrationService.deleteStaleUsers(runId);

        LocalDateTime finishedAt = LocalDateTime.now();

        MigrationReport report = MigrationReport.builder()
            .mode(MigrationMode.MIRROR.name())
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

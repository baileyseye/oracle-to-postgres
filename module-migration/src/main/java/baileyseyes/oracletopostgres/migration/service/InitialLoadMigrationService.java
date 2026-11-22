package baileyseyes.oracletopostgres.migration.service;

import baileyseyes.oracletopostgres.migration.common.exception.MigrationValidationException;
import baileyseyes.oracletopostgres.migration.common.support.SourceRowMapper;
import baileyseyes.oracletopostgres.migration.dto.MigrationReport;
import baileyseyes.oracletopostgres.migration.dto.MigrationValidationReport;
import baileyseyes.oracletopostgres.migration.dto.TableLoadResult;
import baileyseyes.oracletopostgres.migration.dto.ValidationCheck;
import baileyseyes.oracletopostgres.migration.service.plan.InitialLoadTablePlan;
import baileyseyes.oracletopostgres.migration.service.plan.InitialLoadTablePlanBuilder;
import baileyseyes.oracletopostgres.migration.service.row.OrderRow;
import baileyseyes.oracletopostgres.migration.service.row.UserRow;
import baileyseyes.oracletopostgres.migration.target.service.GenericInitialLoadTargetGateway;
import baileyseyes.oracletopostgres.migration.target.service.InitialLoadTargetGateway;
import baileyseyes.oracletopostgres.migration.target.service.PostgresTargetGateway;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Быстрая первичная загрузка Oracle → PostgreSQL на время остановки окружения.
 * <br>
 * Режим не выполняет upsert, adoption и stale-удаление: source id сохраняются,
 * данные пишутся через {@code COPY} чанками, каждый чанк коммитится
 * отдельно. Прерванная загрузка продолжается с {@code MAX(id)} в target.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class InitialLoadMigrationService {

    private static final String USERS_TABLE = "users";
    private static final String ORDERS_TABLE = "orders";
    private static final String KEY_COLUMN = "id";

    private final PostgresTargetGateway targetGateway;
    private final InitialLoadTargetGateway loadGateway;
    private final GenericInitialLoadTargetGateway genericLoadGateway;
    private final InitialLoadSourceGuard sourceGuard;
    private final InitialLoadScriptRunner scriptRunner;
    private final InitialLoadValidationService validationService;
    private final GenericInitialLoadValidationService genericValidationService;
    private final InitialLoadTablePlanBuilder planBuilder;
    private final GenericInitialLoadService genericInitialLoadService;
    private final ParallelTableLoadService parallelTableLoadService;
    private final SourceRowMapper rowMapper;
    private final InitialLoadProperties properties;

    /**
     * Выполняет первичную загрузку users, затем orders.
     */
    public MigrationReport migrateAll(MigrationRunContext context) {
        LocalDateTime startedAt = LocalDateTime.now();

        log.info("Первичная загрузка: chunkSize={}, truncateTarget={}, resume={}, populateMapping={}, "
                + "validate={}, requireSourceIdle={}",
            properties.getChunkSize(), properties.isTruncateTarget(), properties.isResume(),
            properties.isPopulateMapping(), properties.isValidate(), properties.isRequireSourceIdle());

        targetGateway.requireTable(USERS_TABLE);
        targetGateway.requireTable(ORDERS_TABLE);

        if (properties.isPopulateMapping()) {
            targetGateway.requireMappingTable();
        }

        List<InitialLoadTablePlan> genericPlans = planBuilder.buildPlans();
        context.tablesTotal(2 + genericPlans.size());

        context.phase("SOURCE_CHECK");
        SourceGuardResult sourceGuardResult = sourceGuard.check();
        context.sourceScn(sourceGuardResult.scn());
        context.sourceIdle(sourceGuardResult.idle());

        context.phase("PRE_LOAD_SQL");
        scriptRunner.runPreLoad(properties.getPreLoadSql());

        context.phase("PREPARE_TARGET");
        genericInitialLoadService.prepare(genericPlans);
        loadGateway.prepareTarget(properties.isTruncateTarget(), properties.isResume());

        long usersRead = loadUsers(context);
        context.tableCompleted();
        long ordersRead = loadOrders(context);
        context.tableCompleted();

        context.phase("TABLES");
        List<TableLoadResult> genericResults = genericInitialLoadService.load(genericPlans, context);

        context.phase("FINALIZING");
        genericLoadGateway.restartSequences(USERS_TABLE);
        genericLoadGateway.restartSequences(ORDERS_TABLE);

        context.phase("POST_LOAD_SQL");
        scriptRunner.runPostLoad(properties.getPostLoadSql());

        MigrationValidationReport validation = null;

        if (properties.isValidate()) {
            context.phase("VALIDATION");
            validation = mergeValidation(
                validationService.validate(),
                genericValidationService.validate(genericPlans));
        }

        if (validation != null && !validation.valid()) {
            MigrationReport failedReport = buildReport(
                startedAt, usersRead, ordersRead, genericResults, sourceGuardResult, validation);

            throw new MigrationValidationException("Validation initial-load не пройдена. "
                + "Target нельзя открывать приложению.", failedReport);
        }

        if (properties.isPopulateMapping()) {
            context.phase("MAPPING");
            boolean mappingEmpty = properties.isTruncateTarget() || !properties.isResume();
            loadGateway.populateMapping(mappingEmpty);
        }

        if (properties.isAnalyze()) {
            context.phase("ANALYZE");
            loadGateway.analyze(USERS_TABLE);
            loadGateway.analyze(ORDERS_TABLE);
        }

        if (properties.isVacuum()) {
            context.phase("VACUUM");
            genericLoadGateway.vacuum(USERS_TABLE);
            genericLoadGateway.vacuum(ORDERS_TABLE);

            for (InitialLoadTablePlan plan : genericPlans) {
                genericLoadGateway.vacuum(plan.targetTable());
            }
        }

        MigrationReport report = buildReport(
            startedAt, usersRead, ordersRead, genericResults, sourceGuardResult, validation);

        log.info("Первичная загрузка Oracle → PostgreSQL завершена: {}", report);
        return report;
    }

    private MigrationReport buildReport(LocalDateTime startedAt,
                                        long usersRead,
                                        long ordersRead,
                                        List<TableLoadResult> genericResults,
                                        SourceGuardResult sourceGuardResult,
                                        MigrationValidationReport validation) {
        return MigrationReport.builder()
            .mode(MigrationMode.INITIAL_LOAD.name())
            .sourceScn(sourceGuardResult.scn())
            .sourceIdle(sourceGuardResult.idle())
            .validation(validation)
            .startedAt(startedAt)
            .finishedAt(LocalDateTime.now())
            .usersRead(usersRead)
            .usersInserted(usersRead)
            .usersUpdated(0)
            .usersDeleted(0)
            .ordersRead(ordersRead)
            .ordersInserted(ordersRead)
            .ordersUpdated(0)
            .ordersDeleted(0)
            .tables(genericResults)
            .build();
    }

    private MigrationValidationReport mergeValidation(MigrationValidationReport first,
                                                      MigrationValidationReport second) {
        List<ValidationCheck> checks = new ArrayList<>(first.checks());
        checks.addAll(second.checks());

        return new MigrationValidationReport(
            checks.stream().allMatch(ValidationCheck::passed), checks);
    }

    private long loadUsers(MigrationRunContext context) {
        int chunkSize = Math.max(properties.getChunkSize(), 1);
        long startedAt = System.nanoTime();

        context.phase("USERS");
        TableRangeLoadSpec spec = new TableRangeLoadSpec(
            USERS_TABLE,
            USERS_TABLE,
            KEY_COLUMN,
            KEY_COLUMN,
            List.of("ID", "USERNAME", "EMAIL", "CREATED_AT", "UPDATED_AT"),
            chunkSize,
            loadGateway::maxKeyBetween,
            this::copyUserMaps);

        long total = parallelTableLoadService.load(spec, context);
        log.info("Первичная загрузка users завершена: {} строк за {} мс",
            total, millis(System.nanoTime() - startedAt));
        return total;
    }

    private long loadOrders(MigrationRunContext context) {
        int chunkSize = Math.max(properties.getChunkSize(), 1);
        long startedAt = System.nanoTime();

        context.phase("ORDERS");
        TableRangeLoadSpec spec = new TableRangeLoadSpec(
            ORDERS_TABLE,
            ORDERS_TABLE,
            KEY_COLUMN,
            KEY_COLUMN,
            List.of("ID", "USER_ID", "ORDER_NUMBER", "AMOUNT", "STATUS", "CREATED_AT"),
            chunkSize,
            loadGateway::maxKeyBetween,
            this::copyOrderMaps);

        long total = parallelTableLoadService.load(spec, context);
        log.info("Первичная загрузка orders завершена: {} строк за {} мс",
            total, millis(System.nanoTime() - startedAt));
        return total;
    }

    private long millis(long nanos) {
        return nanos / 1_000_000;
    }

    private long copyUserMaps(List<Map<String, Object>> rows) {
        List<UserRow> chunk = rows.stream().map(rowMapper::toUser).toList();
        return loadGateway.copyUsers(chunk);
    }

    private long copyOrderMaps(List<Map<String, Object>> rows) {
        List<OrderRow> chunk = rows.stream().map(rowMapper::toOrder).toList();
        return loadGateway.copyOrders(chunk);
    }
}

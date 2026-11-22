package baileyseyes.oracletopostgres.migration.service;

import baileyseyes.oracletopostgres.migration.common.exception.MigrationConflictException;
import baileyseyes.oracletopostgres.migration.common.exception.MigrationException;
import baileyseyes.oracletopostgres.migration.dto.TableLoadResult;
import baileyseyes.oracletopostgres.migration.service.plan.InitialLoadTablePlan;
import baileyseyes.oracletopostgres.migration.service.plan.TableColumnPlan;
import baileyseyes.oracletopostgres.migration.source.contract.RowReader;
import baileyseyes.oracletopostgres.migration.target.service.GenericInitialLoadTargetGateway;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Generic initial-load для таблиц, кроме специализированных users/orders.
 * <br>
 * Для таблиц с одиночным numeric PK используется keyset-пагинация и resume по MAX(id).
 * Для остальных таблиц — потоковое чтение с COPY-чанками без resume
 * (target должен быть пуст).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class GenericInitialLoadService {

    private final RowReader rowReader;
    private final GenericInitialLoadTargetGateway targetGateway;
    private final InitialLoadProperties properties;
    private final TransactionTemplate targetTransactionTemplate;
    private final ChunkRetryExecutor retryExecutor;
    private final ParallelTableLoadService parallelTableLoadService;

    /**
     * Готовит generic-таблицы: при truncate очищает их до truncate users/orders,
     * чтобы не нарушить FK.
     */
    public void prepare(List<InitialLoadTablePlan> plans) {
        if (plans.isEmpty()) {
            return;
        }

        if (properties.isTruncateTarget()) {
            targetGateway.truncateTables(plans.stream().map(InitialLoadTablePlan::targetTable).toList());
            return;
        }

        if (properties.isResume()) {
            for (InitialLoadTablePlan plan : plans) {
                if (!plan.keyset() && !targetGateway.isEmpty(plan.targetTable())) {
                    throw new MigrationException("Таблица '" + plan.targetTable()
                        + "' не имеет одиночного numeric PK и не может быть продолжена. "
                        + "Очистите её или используйте truncate-target=true.");
                }
            }
            return;
        }

        for (InitialLoadTablePlan plan : plans) {
            if (!targetGateway.isEmpty(plan.targetTable())) {
                throw new MigrationConflictException("Таблица '" + plan.targetTable() + "' не пуста. "
                    + "Задайте truncate-target=true, очистите таблицы вручную "
                    + "или продолжите прерванную загрузку с resume=true.");
            }
        }
    }

    /**
     * Загружает все generic-таблицы.
     */
    public List<TableLoadResult> load(List<InitialLoadTablePlan> plans, MigrationRunContext context) {
        List<TableLoadResult> results = new ArrayList<>();

        for (InitialLoadTablePlan plan : plans) {
            context.phase("TABLES");
            long rows = plan.keyset()
                ? loadKeyset(plan, context)
                : loadStreaming(plan, context);

            targetGateway.restartSequences(plan.targetTable());

            if (properties.isAnalyze()) {
                targetGateway.analyze(plan.targetTable());
            }

            context.tableCompleted();
            results.add(new TableLoadResult(plan.targetTable(), rows));
        }

        return results;
    }

    private long loadKeyset(InitialLoadTablePlan plan, MigrationRunContext context) {
        int chunkSize = chunkSize(plan);
        List<String> sourceColumns = plan.columns().stream()
            .map(TableColumnPlan::sourceColumn)
            .toList();

        TableRangeLoadSpec spec = new TableRangeLoadSpec(
            plan.sourceTable(),
            plan.targetTable(),
            plan.sourceKeyColumn(),
            plan.targetKeyColumn(),
            sourceColumns,
            chunkSize,
            targetGateway::maxKeyBetween,
            rows -> targetGateway.copyRows(plan, rows));

        return parallelTableLoadService.load(spec, context);
    }

    private long loadStreaming(InitialLoadTablePlan plan, MigrationRunContext context) {
        int chunkSize = chunkSize(plan);
        List<Map<String, Object>> buffer = new ArrayList<>(chunkSize);
        long[] total = {0};

        context.progress(plan.targetTable(), 0, 0, 0);

        List<String> sourceColumns = plan.columns().stream()
            .map(TableColumnPlan::sourceColumn)
            .toList();

        rowReader.forEachRow(plan.sourceTable(), sourceColumns, row -> {
            context.checkCancelled();
            buffer.add(row);

            if (buffer.size() >= chunkSize) {
                copyBuffered(plan, buffer);
                total[0] += buffer.size();
                context.progress(plan.targetTable(), 0, total[0], 0);
                buffer.clear();
            }
        });

        if (!buffer.isEmpty()) {
            copyBuffered(plan, buffer);
            total[0] += buffer.size();
            context.progress(plan.targetTable(), 0, total[0], 0);
            buffer.clear();
        }

        context.progress(plan.targetTable(), 0, total[0], 0);
        log.info("Generic initial-load {} (без keyset) завершён: {} строк",
            plan.targetTable(), total[0]);
        return total[0];
    }

    private void copyBuffered(InitialLoadTablePlan plan, List<Map<String, Object>> buffer) {
        int size = buffer.size();

        retryExecutor.execute("initial-load " + plan.targetTable(), () ->
            targetTransactionTemplate.executeWithoutResult(status -> {
                long copied = targetGateway.copyRows(plan, buffer);

                if (copied != size) {
                    throw new MigrationException("COPY " + plan.targetTable() + " загрузил "
                        + copied + " строк вместо " + size);
                }
            }));
    }

    private int chunkSize(InitialLoadTablePlan plan) {
        int configured = plan.hasLobs() ? properties.getLobChunkSize() : properties.getChunkSize();
        return Math.max(configured, 1);
    }
}

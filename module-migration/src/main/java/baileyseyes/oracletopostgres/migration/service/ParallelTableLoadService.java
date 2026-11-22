package baileyseyes.oracletopostgres.migration.service;

import baileyseyes.oracletopostgres.migration.common.exception.MigrationException;
import baileyseyes.oracletopostgres.migration.common.support.RowValues;
import baileyseyes.oracletopostgres.migration.source.contract.RowReader;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Параллельная загрузка одной таблицы диапазонами id.
 * <br>
 * Диапазоны не пересекаются; resume каждого диапазона определяется по
 * {@code MAX(key)} в target внутри диапазона. Отдельная range-таблица не нужна.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ParallelTableLoadService {

    private final RowReader rowReader;
    private final InitialLoadProperties properties;
    private final TransactionTemplate targetTransactionTemplate;
    private final ChunkRetryExecutor retryExecutor;

    /**
     * Загружает таблицу и возвращает число прочитанных строк.
     */
    public long load(TableRangeLoadSpec spec, MigrationRunContext context) {
        long sourceMin = rowReader.minKey(spec.sourceTable(), spec.sourceKeyColumn());
        long sourceMax = rowReader.maxKey(spec.sourceTable(), spec.sourceKeyColumn());

        if (sourceMin == Long.MIN_VALUE && sourceMax == Long.MIN_VALUE) {
            log.info("Parallel initial-load {}: таблица пуста", spec.targetTable());
            return 0;
        }

        int workers = Math.max(properties.getWorkers(), 1);
        List<Range> ranges = ranges(sourceMin, sourceMax, workers);
        ExecutorService executor = Executors.newFixedThreadPool(ranges.size(), threadFactory(spec.targetTable()));
        AtomicLong totalRows = new AtomicLong();
        AtomicLong lastId = new AtomicLong(Long.MIN_VALUE);
        AtomicReference<Throwable> failure = new AtomicReference<>();
        AtomicBoolean stopping = new AtomicBoolean();
        List<Future<?>> futures = new ArrayList<>();

        log.info("Parallel initial-load {}: workers={}, ranges={}, source={}..{}",
            spec.targetTable(), ranges.size(), ranges.size(), sourceMin, sourceMax);

        for (Range range : ranges) {
            futures.add(executor.submit(() -> {
                loadRange(spec, range, context, totalRows, lastId, sourceMax, failure, stopping);
                return null;
            }));
        }

        try {
            for (Future<?> future : futures) {
                future.get();
            }
        } catch (ExecutionException exception) {
            failure.compareAndSet(null, exception.getCause());
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            failure.compareAndSet(null, new MigrationException(
                "Параллельная initial-load прервана", exception));
        } finally {
            stopping.set(true);

            if (failure.get() != null) {
                futures.forEach(future -> future.cancel(true));
            }

            executor.shutdownNow();
        }

        Throwable throwable = failure.get();

        if (throwable instanceof RuntimeException runtimeException) {
            throw runtimeException;
        }

        if (throwable instanceof Error error) {
            throw error;
        }

        if (throwable != null) {
            throw new MigrationException("Ошибка параллельной initial-load", throwable);
        }

        log.info("Parallel initial-load {} завершён: {} строк", spec.targetTable(), totalRows.get());
        return totalRows.get();
    }

    private void loadRange(TableRangeLoadSpec spec,
                           Range range,
                           MigrationRunContext context,
                           AtomicLong totalRows,
                           AtomicLong lastId,
                           long sourceMax,
                           AtomicReference<Throwable> failure,
                           AtomicBoolean stopping) {
        long after = properties.isResume()
            ? spec.resume().maxKeyBetween(spec.targetTable(), spec.targetKeyColumn(), range.from(), range.to())
            : before(range.from());

        if (after == Long.MIN_VALUE) {
            after = before(range.from());
        }

        try {
            while (!stopping.get() && failure.get() == null) {
                context.checkCancelled();

                long pageAfter = after;
                List<Map<String, Object>> page = retryExecutor.execute(
                    "parallel initial-load " + spec.targetTable(),
                    () -> readAndWrite(spec, pageAfter, range.to()));

                if (page.isEmpty()) {
                    return;
                }

                Long nextValue = RowValues.asLong(page.getLast(), spec.sourceKeyColumn());

                if (nextValue == null) {
                    throw new MigrationException("В строке отсутствует ключевая колонка "
                        + spec.sourceKeyColumn());
                }

                long next = nextValue;

                after = next;
                long loaded = totalRows.addAndGet(page.size());
                lastId.accumulateAndGet(next, Math::max);
                context.progress(spec.targetTable(), lastId.get(), loaded, sourceMax);
            }
        } catch (Throwable throwable) {
            failure.compareAndSet(null, throwable);
            stopping.set(true);
        }
    }

    private List<Map<String, Object>> readAndWrite(TableRangeLoadSpec spec, long after, long to) {
        List<Map<String, Object>> page = rowReader.readRowsAfter(
            spec.sourceTable(), spec.sourceKeyColumn(), after, to,
            spec.chunkSize(), spec.sourceColumns());

        if (page.isEmpty()) {
            return page;
        }

        targetTransactionTemplate.executeWithoutResult(status -> {
            long copied = spec.writer().write(page);

            if (copied != page.size()) {
                throw new MigrationException("COPY " + spec.targetTable() + " загрузил "
                    + copied + " строк вместо " + page.size());
            }
        });

        return page;
    }

    private List<Range> ranges(long sourceMin, long sourceMax, int workers) {
        if (sourceMin == sourceMax || workers <= 1) {
            return List.of(new Range(sourceMin, sourceMax));
        }

        long span = sourceMax - sourceMin;
        long count = Math.min(workers, Math.max(span + 1, 1));
        long step = Math.max(span / count + 1, 1);
        List<Range> ranges = new ArrayList<>();
        long from = sourceMin;

        for (int index = 0; index < count && from <= sourceMax; index++) {
            long to = index == count - 1 ? sourceMax : Math.min(from + step - 1, sourceMax);

            if (to < from) {
                to = sourceMax;
            }

            ranges.add(new Range(from, to));
            from = to + 1;
        }

        return ranges;
    }

    private long before(long from) {
        return from == Long.MIN_VALUE ? Long.MIN_VALUE : from - 1;
    }

    private ThreadFactory threadFactory(String table) {
        return runnable -> {
            Thread thread = new Thread(runnable, "initial-load-" + table + "-worker");
            thread.setDaemon(true);
            return thread;
        };
    }

    private record Range(long from, long to) {
    }
}

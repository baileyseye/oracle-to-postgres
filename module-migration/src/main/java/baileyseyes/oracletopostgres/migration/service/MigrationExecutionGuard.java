package baileyseyes.oracletopostgres.migration.service;

import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Защита от одновременного запуска sync- и async-миграции в одном процессе.
 */
final class MigrationExecutionGuard {

    private final AtomicBoolean running = new AtomicBoolean();

    boolean tryAcquire() {
        return running.compareAndSet(false, true);
    }

    void release() {
        running.set(false);
    }

    boolean isRunning() {
        return running.get();
    }
}

package baileyseyes.oracletopostgres.migration.service;

import baileyseyes.oracletopostgres.migration.common.exception.MigrationCancelledException;

/**
 * Контекст одного запуска миграции для progress и отмены.
 * <br>
 * Для синхронного {@code /run} используется no-op контекст.
 */
public final class MigrationRunContext {

    private final MigrationJobState job;

    public MigrationRunContext(MigrationJobState job) {
        this.job = job;
    }

    public static MigrationRunContext noop() {
        return new MigrationRunContext(null);
    }

    public void phase(String phase) {
        if (job != null) {
            job.phase(phase);
        }
    }

    public void progress(String table, long lastId, long rowsLoaded, long sourceMaxId) {
        if (job != null) {
            job.progress(table, lastId, rowsLoaded, sourceMaxId);
        }
    }

    public void tablesTotal(int tablesTotal) {
        if (job != null) {
            job.tablesTotal(tablesTotal);
        }
    }

    public void tableCompleted() {
        if (job != null) {
            job.tableCompleted();
        }
    }

    public void sourceScn(Long sourceScn) {
        if (job != null) {
            job.sourceScn(sourceScn);
        }
    }

    public void sourceIdle(Boolean sourceIdle) {
        if (job != null) {
            job.sourceIdle(sourceIdle);
        }
    }

    public void checkCancelled() {
        if (job == null) {
            return;
        }

        if (job.isCancelRequested() || Thread.currentThread().isInterrupted()) {
            throw new MigrationCancelledException(job.jobId());
        }
    }
}

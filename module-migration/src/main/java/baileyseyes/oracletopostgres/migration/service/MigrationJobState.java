package baileyseyes.oracletopostgres.migration.service;

import baileyseyes.oracletopostgres.migration.dto.MigrationJobResponse;
import baileyseyes.oracletopostgres.migration.dto.MigrationReport;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Состояние одного асинхронного запуска миграции.
 */
public class MigrationJobState {

    private final String jobId;
    private final MigrationMode mode;
    private final LocalDateTime startedAt;
    private final AtomicBoolean cancelRequested = new AtomicBoolean();

    private volatile MigrationJobStatus status = MigrationJobStatus.RUNNING;
    private volatile String phase = "STARTING";
    private volatile String table;
    private volatile Long lastId;
    private volatile Long sourceMaxId;
    private volatile Long sourceScn;
    private volatile Boolean sourceIdle;
    private volatile Integer tablesTotal;
    private volatile int tablesCompleted;
    private volatile long totalRowsLoaded;
    private volatile long currentTableRows;
    private volatile MigrationReport report;
    private volatile String error;
    private volatile LocalDateTime finishedAt;

    public MigrationJobState(String jobId, MigrationMode mode) {
        this.jobId = jobId;
        this.mode = mode;
        this.startedAt = LocalDateTime.now();
    }

    public String jobId() {
        return jobId;
    }

    public MigrationMode mode() {
        return mode;
    }

    public LocalDateTime startedAt() {
        return startedAt;
    }

    public String phase() {
        return phase;
    }

    public MigrationJobStatus status() {
        return status;
    }

    public boolean isFinished() {
        return status != MigrationJobStatus.RUNNING;
    }

    public boolean isCancelRequested() {
        return cancelRequested.get();
    }

    public void phase(String phase) {
        this.phase = phase;
    }

    public synchronized void progress(String table, long lastId, long rowsLoaded, long sourceMaxId) {
        if (this.table != null && !this.table.equals(table)) {
            this.totalRowsLoaded += this.currentTableRows;
        }

        this.table = table;
        this.lastId = lastId;
        this.currentTableRows = rowsLoaded;
        this.sourceMaxId = sourceMaxId;
    }

    public synchronized void tablesTotal(int tablesTotal) {
        this.tablesTotal = tablesTotal;
    }

    public synchronized void tableCompleted() {
        this.tablesCompleted++;
    }

    public void sourceScn(Long sourceScn) {
        this.sourceScn = sourceScn;
    }

    public void sourceIdle(Boolean sourceIdle) {
        this.sourceIdle = sourceIdle;
    }

    public void requestCancel() {
        cancelRequested.set(true);
        phase = "CANCELLING";
    }

    public void complete(MigrationReport report) {
        this.report = report;
        this.finishedAt = LocalDateTime.now();
        this.status = MigrationJobStatus.SUCCEEDED;
    }

    public void fail(Throwable throwable, MigrationReport report) {
        this.report = report;
        this.error = throwable.getMessage();
        this.finishedAt = LocalDateTime.now();
        this.status = MigrationJobStatus.FAILED;
    }

    public void cancel() {
        this.finishedAt = LocalDateTime.now();
        this.status = MigrationJobStatus.CANCELLED;
    }

    public MigrationJobResponse toResponse() {
        LocalDateTime end = finishedAt == null ? LocalDateTime.now() : finishedAt;
        long durationSeconds = Duration.between(startedAt, end).toSeconds();
        long totalRows;

        synchronized (this) {
            totalRows = totalRowsLoaded + currentTableRows;
        }

        Long rowsPerSecond = durationSeconds > 0 ? totalRows / durationSeconds : null;
        Long etaSeconds = null;

        if (rowsPerSecond != null && rowsPerSecond > 0 && lastId != null
            && sourceMaxId != null && sourceMaxId > lastId) {
            etaSeconds = (sourceMaxId - lastId) / rowsPerSecond;
        }

        return new MigrationJobResponse(
            jobId,
            mode.name(),
            status.name(),
            phase,
            table,
            lastId,
            totalRows,
            sourceMaxId,
            sourceScn,
            sourceIdle,
            tablesTotal,
            tablesCompleted,
            rowsPerSecond,
            etaSeconds,
            startedAt,
            finishedAt,
            durationSeconds,
            report,
            error);
    }
}

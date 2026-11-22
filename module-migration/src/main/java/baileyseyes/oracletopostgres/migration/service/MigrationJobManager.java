package baileyseyes.oracletopostgres.migration.service;

import baileyseyes.oracletopostgres.migration.common.exception.MigrationCancelledException;
import baileyseyes.oracletopostgres.migration.common.exception.MigrationConflictException;
import baileyseyes.oracletopostgres.migration.common.exception.MigrationException;
import baileyseyes.oracletopostgres.migration.common.exception.MigrationJobNotFoundException;
import baileyseyes.oracletopostgres.migration.common.exception.MigrationValidationException;
import baileyseyes.oracletopostgres.migration.dto.MigrationJobResponse;
import baileyseyes.oracletopostgres.migration.dto.MigrationReport;
import java.util.Comparator;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicReference;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.task.TaskExecutor;
import org.springframework.core.task.TaskRejectedException;
import org.springframework.stereotype.Service;

/**
 * Менеджер асинхронных запусков миграции.
 * <br>
 * В одном процессе допускается только один активный job.
 * Состояние хранится в памяти; после рестарта приложения
 * незавершённый initial-load продолжается через {@code resume=true}.
 */
@Slf4j
@Service
public class MigrationJobManager {

    private static final int MAX_FINISHED_JOBS = 50;

    private final MigrationRunService migrationRunService;
    private final TaskExecutor taskExecutor;
    private final ConcurrentHashMap<String, MigrationJobState> jobs = new ConcurrentHashMap<>();
    private final AtomicReference<MigrationJobState> activeJob = new AtomicReference<>();

    public MigrationJobManager(MigrationRunService migrationRunService,
                               @Qualifier("migrationJobExecutor") TaskExecutor taskExecutor) {
        this.migrationRunService = migrationRunService;
        this.taskExecutor = taskExecutor;
    }

    /**
     * Запускает миграцию в фоне и возвращает начальное состояние job.
     */
    public MigrationJobResponse start() {
        if (migrationRunService.isRunning()) {
            throw new MigrationConflictException("Уже выполняется другой запуск миграции");
        }

        MigrationJobState job = new MigrationJobState(
            UUID.randomUUID().toString(), migrationRunService.mode());

        if (!activeJob.compareAndSet(null, job)) {
            throw new MigrationConflictException("Уже выполняется другой запуск миграции");
        }

        cleanupFinishedJobs();
        jobs.put(job.jobId(), job);

        try {
            taskExecutor.execute(() -> execute(job));
        } catch (TaskRejectedException exception) {
            activeJob.compareAndSet(job, null);
            jobs.remove(job.jobId());
            throw new MigrationException(
                "Не удалось поставить job миграции в очередь", exception);
        }

        return job.toResponse();
    }

    /**
     * Возвращает состояние job.
     */
    public MigrationJobResponse get(String jobId) {
        return find(jobId).toResponse();
    }

    /**
     * Запрашивает отмену initial-load job между чанками.
     */
    public MigrationJobResponse cancel(String jobId) {
        MigrationJobState job = find(jobId);

        if (job.mode() == MigrationMode.MIRROR) {
            throw new MigrationConflictException("Отмена mirror-режима не поддерживается: "
                + "он выполняется в одной транзакции");
        }

        if (job.status() != MigrationJobStatus.RUNNING) {
            throw new MigrationConflictException("Job уже завершён со статусом " + job.status());
        }

        if ("FINALIZING".equals(job.phase()) || "POST_LOAD_SQL".equals(job.phase())
            || "VALIDATION".equals(job.phase()) || "ANALYZE".equals(job.phase())) {
            throw new MigrationConflictException("Отмена невозможна: загрузка уже завершена, "
                + "идёт финализация job");
        }

        job.requestCancel();
        return job.toResponse();
    }

    private void execute(MigrationJobState job) {
        try {
            job.phase("STARTING");
            MigrationReport report = migrationRunService.run(new MigrationRunContext(job));
            job.complete(report);
            log.info("Job миграции {} завершён: {}", job.jobId(), report);
        } catch (MigrationCancelledException exception) {
            job.cancel();
            log.warn("Job миграции {} отменён", job.jobId());
        } catch (MigrationValidationException exception) {
            job.fail(exception, exception.getReport());
            log.error("Job миграции {} не прошёл validation: {}", job.jobId(), exception.getMessage());
        } catch (Throwable throwable) {
            job.fail(throwable, null);
            log.error("Job миграции {} завершился ошибкой", job.jobId(), throwable);
        } finally {
            activeJob.compareAndSet(job, null);
        }
    }

    private MigrationJobState find(String jobId) {
        MigrationJobState job = jobs.get(jobId);

        if (job == null) {
            throw new MigrationJobNotFoundException(jobId);
        }

        return job;
    }

    private void cleanupFinishedJobs() {
        while (jobs.size() >= MAX_FINISHED_JOBS) {
            String oldestFinished = jobs.values().stream()
                .filter(MigrationJobState::isFinished)
                .min(Comparator.comparing(MigrationJobState::startedAt))
                .map(MigrationJobState::jobId)
                .orElse(null);

            if (oldestFinished == null) {
                return;
            }

            jobs.remove(oldestFinished);
        }
    }
}

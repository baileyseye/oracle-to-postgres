package baileyseyes.oracletopostgres.migration.service;

import baileyseyes.oracletopostgres.migration.common.exception.MigrationConflictException;
import baileyseyes.oracletopostgres.migration.dto.MigrationReport;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Точка выбора режима миграции.
 * <br>
 * Режим задаётся свойством {@code migration.mode}
 * (обычно через env {@code MIGRATION_MODE}). По умолчанию используется
 * {@code initial-load} — миграция с остановкой окружения.
 * Альтернативный вариант — {@code mirror}:
 * зеркальная синхронизация без остановки,
 * с upsert/adoption/stale по {@code migration_entity_map}.
 */
@Slf4j
@Service
public class MigrationRunService {

    private final MigrationOrchestrationService mirrorMigration;
    private final InitialLoadMigrationService initialLoadMigration;
    private final MigrationMode mode;
    private final MigrationExecutionGuard executionGuard = new MigrationExecutionGuard();

    public MigrationRunService(MigrationOrchestrationService mirrorMigration,
                               InitialLoadMigrationService initialLoadMigration,
                               @Value("${migration.mode:initial-load}") String mode) {
        this.mirrorMigration = mirrorMigration;
        this.initialLoadMigration = initialLoadMigration;
        this.mode = MigrationMode.from(mode);
        log.info("Режим миграции: {}", this.mode);
    }

    public MigrationMode mode() {
        return mode;
    }

    public boolean isRunning() {
        return executionGuard.isRunning();
    }

    /**
     * Запускает миграцию синхронно.
     */
    public MigrationReport run() {
        return run(MigrationRunContext.noop());
    }

    /**
     * Запускает миграцию с контекстом progress/cancel.
     */
    public MigrationReport run(MigrationRunContext context) {
        if (!executionGuard.tryAcquire()) {
            throw new MigrationConflictException("Уже выполняется другой запуск миграции");
        }

        try {
            MigrationReport report = switch (mode) {
                case MIRROR -> mirrorMigration.migrateAll();
                case INITIAL_LOAD -> initialLoadMigration.migrateAll(context);
            };

            report.setMode(mode.name());
            return report;
        } finally {
            executionGuard.release();
        }
    }
}

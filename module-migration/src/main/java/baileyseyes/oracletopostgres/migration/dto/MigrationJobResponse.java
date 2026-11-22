package baileyseyes.oracletopostgres.migration.dto;

import java.time.LocalDateTime;

/**
 * Состояние асинхронного запуска миграции.
 */
public record MigrationJobResponse(String jobId,
                                   String mode,
                                   String status,
                                   String phase,
                                   String table,
                                   Long lastId,
                                   long rowsLoaded,
                                   Long sourceMaxId,
                                   Long sourceScn,
                                   Boolean sourceIdle,
                                   Integer tablesTotal,
                                   int tablesCompleted,
                                   Long rowsPerSecond,
                                   Long etaSeconds,
                                   LocalDateTime startedAt,
                                   LocalDateTime finishedAt,
                                   Long durationSeconds,
                                   MigrationReport report,
                                   String error) {
}

package baileyseyes.oracletopostgres.migration.service;

/**
 * Статус асинхронного job миграции.
 */
public enum MigrationJobStatus {
    RUNNING,
    SUCCEEDED,
    FAILED,
    CANCELLED
}

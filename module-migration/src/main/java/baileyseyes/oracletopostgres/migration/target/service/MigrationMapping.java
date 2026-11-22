package baileyseyes.oracletopostgres.migration.target.service;

/**
 * Соответствие одной исходной строки её целевой строке.
 *
 * @param targetId  идентификатор строки в PostgreSQL
 * @param sourceKey натуральный ключ на момент последней успешной синхронизации
 */
public record MigrationMapping(long targetId, String sourceKey) {
}

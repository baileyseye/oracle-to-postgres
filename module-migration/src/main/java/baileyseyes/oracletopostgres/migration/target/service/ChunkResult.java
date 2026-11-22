package baileyseyes.oracletopostgres.migration.target.service;

/**
 * Результат применения одного staging-чанка к целевой таблице.
 */
public record ChunkResult(long inserted, long updated) {
}

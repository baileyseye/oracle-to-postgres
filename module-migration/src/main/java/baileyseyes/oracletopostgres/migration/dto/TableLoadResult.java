package baileyseyes.oracletopostgres.migration.dto;

/**
 * Итог загрузки одной generic-таблицы.
 */
public record TableLoadResult(String table, long rows) {
}

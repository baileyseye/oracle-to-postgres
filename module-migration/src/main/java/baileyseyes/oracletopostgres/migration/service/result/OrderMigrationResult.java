package baileyseyes.oracletopostgres.migration.service.result;

/**
 * Итоги переноса заказов.
 */
public record OrderMigrationResult(long total, long inserted, long updated, long deleted) {
}

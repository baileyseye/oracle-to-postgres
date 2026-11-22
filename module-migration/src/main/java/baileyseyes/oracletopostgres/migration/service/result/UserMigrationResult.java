package baileyseyes.oracletopostgres.migration.service.result;

/**
 * Итоги переноса пользователей.
 * <br>
 * Карта source id → target id больше не возвращается в Java: заказы разрешают
 * пользователей через {@code migration_entity_map} внутри PostgreSQL.
 */
public record UserMigrationResult(long total, long inserted, long updated) {
}

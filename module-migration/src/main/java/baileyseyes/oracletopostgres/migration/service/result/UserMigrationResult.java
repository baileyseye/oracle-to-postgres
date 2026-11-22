package baileyseyes.oracletopostgres.migration.service.result;

import java.util.Map;
import java.util.Set;

/**
 * Итоги переноса пользователей и карта «исходный id → целевой id».
 */
public record UserMigrationResult(long total,
                                  long inserted,
                                  long updated,
                                  Map<Long, Long> userIdMapping,
                                  Set<Long> staleSourceIds) {
}

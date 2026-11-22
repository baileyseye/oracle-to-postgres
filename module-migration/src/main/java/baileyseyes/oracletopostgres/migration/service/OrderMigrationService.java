package baileyseyes.oracletopostgres.migration.service;

import baileyseyes.oracletopostgres.migration.common.exception.MigrationException;
import baileyseyes.oracletopostgres.migration.common.support.SourceRowMapper;
import baileyseyes.oracletopostgres.migration.service.result.OrderMigrationResult;
import baileyseyes.oracletopostgres.migration.service.row.OrderRow;
import baileyseyes.oracletopostgres.migration.source.config.MigrationSourceProperties;
import baileyseyes.oracletopostgres.migration.source.contract.RowReader;
import baileyseyes.oracletopostgres.migration.target.service.ChunkResult;
import baileyseyes.oracletopostgres.migration.target.service.PostgresChunkGateway;
import baileyseyes.oracletopostgres.migration.target.service.PostgresTargetGateway;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Зеркальный перенос заказов из Oracle в PostgreSQL.
 * <br>
 * Таблица читается keyset-страницами по {@code id}. Связь с пользователем
 * разрешается в PostgreSQL join-ом staging-таблицы с {@code migration_entity_map},
 * без хранения карты source user id → target user id в памяти Java.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OrderMigrationService {

    private static final String TABLE = "orders";
    private static final String KEY_COLUMN = "id";

    private final RowReader rowReader;
    private final SourceRowMapper rowMapper;
    private final PostgresTargetGateway targetGateway;
    private final PostgresChunkGateway chunkGateway;
    private final MigrationSourceProperties properties;

    public OrderMigrationResult migrate(long runId) {
        targetGateway.requireTable(TABLE);
        targetGateway.requireMappingTable();
        chunkGateway.prepareOrderStaging();

        int chunkSize = Math.max(properties.getChunkSize(), 1);
        long lastSourceId = Long.MIN_VALUE;
        long total = 0;
        long inserted = 0;
        long updated = 0;

        while (true) {
            List<Map<String, Object>> rows = rowReader.readRowsAfter(
                TABLE, KEY_COLUMN, lastSourceId, chunkSize);

            if (rows.isEmpty()) {
                break;
            }

            List<OrderRow> chunk = rows.stream().map(rowMapper::toOrder).toList();
            total += chunk.size();

            chunkGateway.stageOrders(chunk);
            ChunkResult result = chunkGateway.applyOrderChunk(runId);
            inserted += result.inserted();
            updated += result.updated();

            long nextSourceId = chunk.getLast().sourceId();

            if (nextSourceId <= lastSourceId) {
                throw new MigrationException("Keyset-чтение orders не продвинулось: "
                    + lastSourceId + " → " + nextSourceId);
            }

            lastSourceId = nextSourceId;

            if (rows.size() < chunkSize) {
                break;
            }
        }

        long deleted = chunkGateway.deleteStaleOrders(runId);

        log.info("Зеркальный перенос заказов завершён: всего={}, вставлено={}, обновлено={}, удалено={}",
            total, inserted, updated, deleted);

        return new OrderMigrationResult(total, inserted, updated, deleted);
    }

}

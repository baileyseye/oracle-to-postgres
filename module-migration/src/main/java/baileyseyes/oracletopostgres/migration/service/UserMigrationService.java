package baileyseyes.oracletopostgres.migration.service;

import baileyseyes.oracletopostgres.migration.common.exception.MigrationException;
import baileyseyes.oracletopostgres.migration.common.support.SourceRowMapper;
import baileyseyes.oracletopostgres.migration.service.result.UserMigrationResult;
import baileyseyes.oracletopostgres.migration.service.row.UserRow;
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
 * Зеркальный перенос пользователей из Oracle в PostgreSQL.
 * <br>
 * Таблица читается keyset-страницами по {@code id}; каждая страница проходит через
 * временную staging-таблицу PostgreSQL. Соответствие source id → target id хранится
 * только в {@code migration_entity_map}, поэтому память Java не зависит от объёма таблицы.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UserMigrationService {

    private static final String TABLE = "users";
    private static final String KEY_COLUMN = "id";

    private final RowReader rowReader;
    private final SourceRowMapper rowMapper;
    private final PostgresTargetGateway targetGateway;
    private final PostgresChunkGateway chunkGateway;
    private final MigrationSourceProperties properties;

    public UserMigrationResult migrate(long runId) {
        targetGateway.requireTable(TABLE);
        targetGateway.requireMappingTable();
        chunkGateway.prepareUserStaging();

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

            List<UserRow> chunk = rows.stream().map(rowMapper::toUser).toList();
            total += chunk.size();

            chunkGateway.stageUsers(chunk);
            ChunkResult result = chunkGateway.applyUserChunk(runId);
            inserted += result.inserted();
            updated += result.updated();

            long nextSourceId = chunk.getLast().sourceId();

            if (nextSourceId <= lastSourceId) {
                throw new MigrationException("Keyset-чтение users не продвинулось: "
                    + lastSourceId + " → " + nextSourceId);
            }

            lastSourceId = nextSourceId;

            if (rows.size() < chunkSize) {
                break;
            }
        }

        log.info("Зеркальный перенос пользователей завершён: всего={}, вставлено={}, обновлено={}",
            total, inserted, updated);

        return new UserMigrationResult(total, inserted, updated);
    }

    /**
     * Удаляет из PostgreSQL пользователей, которые ранее были перенесены,
     * но исчезли из Oracle. Вызывается после удаления устаревших заказов.
     */
    public long deleteStaleUsers(long runId) {
        return chunkGateway.deleteStaleUsers(runId);
    }

}

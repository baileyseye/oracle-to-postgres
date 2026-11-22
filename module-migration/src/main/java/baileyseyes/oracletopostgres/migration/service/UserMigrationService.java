package baileyseyes.oracletopostgres.migration.service;

import baileyseyes.oracletopostgres.migration.common.exception.MigrationException;
import baileyseyes.oracletopostgres.migration.common.support.MigrationEntity;
import baileyseyes.oracletopostgres.migration.common.support.RowValues;
import baileyseyes.oracletopostgres.migration.service.result.UserMigrationResult;
import baileyseyes.oracletopostgres.migration.source.contract.RowReader;
import baileyseyes.oracletopostgres.migration.target.service.MigrationMapping;
import baileyseyes.oracletopostgres.migration.target.service.PostgresTargetGateway;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Зеркальный перенос пользователей из Oracle в PostgreSQL.
 * <br>
 * Соответствие исходного и целевого id хранится в служебной таблице
 * {@code migration_entity_map}. Благодаря этому при следующем запуске пользователь
 * обновляется по стабильному source id даже после смены username, а строки,
 * удалённые из Oracle, удаляются и в PostgreSQL.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UserMigrationService {

    private static final String TABLE = "users";

    private final RowReader rowReader;
    private final PostgresTargetGateway targetGateway;

    public UserMigrationResult migrate() {
        targetGateway.requireTable(TABLE);
        targetGateway.requireMappingTable();

        Map<Long, MigrationMapping> mappings = new LinkedHashMap<>(
            targetGateway.findMappings(MigrationEntity.USER));
        Map<String, Long> targetIdsByUsername = targetGateway.findAllUserIdsByUsername();
        Map<Long, Long> userIdMapping = new LinkedHashMap<>();
        Set<Long> sourceIds = new LinkedHashSet<>();
        long[] counters = new long[2];
        long[] total = new long[1];

        rowReader.forEachRow(TABLE, row -> {
            total[0]++;

            Long sourceId = RowValues.asLong(row, "id");
            String username = RowValues.asString(row, "username");
            String email = RowValues.asString(row, "email");
            LocalDateTime createdAt = RowValues.asLocalDateTime(row, "created_at");
            LocalDateTime updatedAt = RowValues.asLocalDateTime(row, "updated_at");

            requireValue(sourceId, "id", username);
            requireValue(username, "username", username);
            requireValue(email, "email", username);
            requireValue(createdAt, "created_at", username);
            requireValue(updatedAt, "updated_at", username);

            sourceIds.add(sourceId);

            MigrationMapping previous = mappings.get(sourceId);
            long targetId = resolveTargetId(
                sourceId, username, email, createdAt, updatedAt,
                mappings, targetIdsByUsername, counters);

            if (previous != null) {
                targetIdsByUsername.remove(previous.sourceKey(), previous.targetId());
            }

            mappings.put(sourceId, new MigrationMapping(targetId, username));
            targetIdsByUsername.put(username, targetId);
            userIdMapping.put(sourceId, targetId);

            targetGateway.upsertMapping(MigrationEntity.USER, sourceId, targetId, username);
        });

        Set<Long> staleSourceIds = new LinkedHashSet<>(mappings.keySet());
        staleSourceIds.removeAll(sourceIds);

        log.info("Зеркальный перенос пользователей завершён: всего={}, вставлено={}, обновлено={}, "
                + "кандидатов на удаление={}",
            total[0], counters[0], counters[1], staleSourceIds.size());

        return new UserMigrationResult(
            total[0], counters[0], counters[1], Map.copyOf(userIdMapping), Set.copyOf(staleSourceIds));
    }

    /**
     * Удаляет из PostgreSQL пользователей, которые ранее были перенесены,
     * но исчезли из Oracle. Вызывается после удаления устаревших заказов.
     */
    public long deleteStaleUsers(Set<Long> staleSourceIds) {
        if (staleSourceIds == null || staleSourceIds.isEmpty()) {
            return 0;
        }

        Map<Long, MigrationMapping> mappings = targetGateway.findMappings(MigrationEntity.USER);
        long deleted = 0;

        for (Long sourceId : staleSourceIds) {
            MigrationMapping mapping = mappings.get(sourceId);

            if (mapping == null) {
                continue;
            }

            if (targetGateway.deleteUser(mapping.targetId())) {
                deleted++;
            }

            targetGateway.deleteMapping(MigrationEntity.USER, sourceId);
        }

        log.info("Удалено пользователей, исчезнувших из Oracle: {}", deleted);
        return deleted;
    }

    private long resolveTargetId(long sourceId, String username, String email,
                                 LocalDateTime createdAt, LocalDateTime updatedAt,
                                 Map<Long, MigrationMapping> mappings,
                                 Map<String, Long> targetIdsByUsername,
                                 long[] counters) {
        MigrationMapping mapping = mappings.get(sourceId);

        if (mapping != null) {
            if (targetGateway.updateUser(mapping.targetId(), username, email, createdAt, updatedAt)) {
                counters[1]++;
                return mapping.targetId();
            }

            targetGateway.deleteMapping(MigrationEntity.USER, sourceId);
            mappings.remove(sourceId);
            targetIdsByUsername.remove(mapping.sourceKey(), mapping.targetId());
        }

        Long adoptedId = targetIdsByUsername.get(username);

        if (adoptedId != null) {
            if (targetGateway.updateUser(adoptedId, username, email, createdAt, updatedAt)) {
                counters[1]++;
                return adoptedId;
            }

            targetIdsByUsername.remove(username);
        }

        counters[0]++;
        return targetGateway.insertUser(username, email, createdAt, updatedAt);
    }

    private <T> void requireValue(T value, String field, String username) {
        if (value == null) {
            throw new MigrationException("У пользователя '" + username + "' отсутствует обязательное поле " + field);
        }
    }
}

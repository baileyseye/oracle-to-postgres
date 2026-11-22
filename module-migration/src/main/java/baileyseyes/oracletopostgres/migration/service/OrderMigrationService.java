package baileyseyes.oracletopostgres.migration.service;

import baileyseyes.oracletopostgres.migration.common.exception.MigrationException;
import baileyseyes.oracletopostgres.migration.common.support.MigrationEntity;
import baileyseyes.oracletopostgres.migration.common.support.RowValues;
import baileyseyes.oracletopostgres.migration.service.result.OrderMigrationResult;
import baileyseyes.oracletopostgres.migration.source.contract.RowReader;
import baileyseyes.oracletopostgres.migration.target.service.MigrationMapping;
import baileyseyes.oracletopostgres.migration.target.service.PostgresTargetGateway;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Зеркальный перенос заказов из Oracle в PostgreSQL.
 * <br>
 * Соответствие исходного и целевого id хранится в {@code migration_entity_map}.
 * Связь с пользователем пересчитывается через карту source user id → target user id.
 * Заказы, удалённые из Oracle, удаляются из PostgreSQL.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OrderMigrationService {

    private static final String TABLE = "orders";
    private static final Set<String> ALLOWED_STATUSES = Set.of("NEW", "PAID", "SHIPPED", "CANCELLED");

    private final RowReader rowReader;
    private final PostgresTargetGateway targetGateway;

    public OrderMigrationResult migrate(Map<Long, Long> userIdMapping) {
        targetGateway.requireTable(TABLE);
        targetGateway.requireMappingTable();

        Map<Long, MigrationMapping> mappings = new LinkedHashMap<>(
            targetGateway.findMappings(MigrationEntity.ORDER));
        Map<String, Long> targetIdsByOrderNumber = targetGateway.findAllOrderIdsByOrderNumber();
        Set<Long> sourceIds = new LinkedHashSet<>();
        long[] counters = new long[2];
        long[] total = new long[1];

        rowReader.forEachRow(TABLE, row -> {
            total[0]++;

            Long sourceId = RowValues.asLong(row, "id");
            Long sourceUserId = RowValues.asLong(row, "user_id");
            String orderNumber = RowValues.asString(row, "order_number");
            BigDecimal amount = RowValues.asBigDecimal(row, "amount");
            String status = RowValues.asString(row, "status");
            LocalDateTime createdAt = RowValues.asLocalDateTime(row, "created_at");

            requireValue(sourceId, "id", orderNumber);
            requireValue(sourceUserId, "user_id", orderNumber);
            requireValue(orderNumber, "order_number", orderNumber);
            requireValue(amount, "amount", orderNumber);
            requireValue(status, "status", orderNumber);
            requireValue(createdAt, "created_at", orderNumber);

            if (!ALLOWED_STATUSES.contains(status)) {
                throw new MigrationException("У заказа '" + orderNumber
                    + "' недопустимый статус '" + status + "'");
            }

            Long targetUserId = userIdMapping.get(sourceUserId);

            if (targetUserId == null) {
                throw new MigrationException("Для заказа '" + orderNumber + "' не найден пользователь "
                    + "с исходным id=" + sourceUserId + " в карте миграции");
            }

            sourceIds.add(sourceId);

            MigrationMapping previous = mappings.get(sourceId);
            long targetId = resolveTargetId(
                sourceId, targetUserId, orderNumber, amount, status, createdAt,
                mappings, targetIdsByOrderNumber, counters);

            if (previous != null) {
                targetIdsByOrderNumber.remove(previous.sourceKey(), previous.targetId());
            }

            mappings.put(sourceId, new MigrationMapping(targetId, orderNumber));
            targetIdsByOrderNumber.put(orderNumber, targetId);

            targetGateway.upsertMapping(MigrationEntity.ORDER, sourceId, targetId, orderNumber);
        });

        Set<Long> staleSourceIds = new LinkedHashSet<>(mappings.keySet());
        staleSourceIds.removeAll(sourceIds);
        long deleted = deleteStaleOrders(staleSourceIds, mappings);

        log.info("Зеркальный перенос заказов завершён: всего={}, вставлено={}, обновлено={}, удалено={}",
            total[0], counters[0], counters[1], deleted);

        return new OrderMigrationResult(total[0], counters[0], counters[1], deleted);
    }

    private long deleteStaleOrders(Set<Long> staleSourceIds, Map<Long, MigrationMapping> mappings) {
        long deleted = 0;

        for (Long sourceId : staleSourceIds) {
            MigrationMapping mapping = mappings.get(sourceId);

            if (mapping == null) {
                continue;
            }

            if (targetGateway.deleteOrder(mapping.targetId())) {
                deleted++;
            }

            targetGateway.deleteMapping(MigrationEntity.ORDER, sourceId);
        }

        return deleted;
    }

    private long resolveTargetId(long sourceId, long targetUserId, String orderNumber,
                                 BigDecimal amount, String status, LocalDateTime createdAt,
                                 Map<Long, MigrationMapping> mappings,
                                 Map<String, Long> targetIdsByOrderNumber,
                                 long[] counters) {
        MigrationMapping mapping = mappings.get(sourceId);

        if (mapping != null) {
            if (targetGateway.updateOrder(
                mapping.targetId(), targetUserId, orderNumber, amount, status, createdAt)) {
                counters[1]++;
                return mapping.targetId();
            }

            targetGateway.deleteMapping(MigrationEntity.ORDER, sourceId);
            mappings.remove(sourceId);
            targetIdsByOrderNumber.remove(mapping.sourceKey(), mapping.targetId());
        }

        Long adoptedId = targetIdsByOrderNumber.get(orderNumber);

        if (adoptedId != null) {
            if (targetGateway.updateOrder(adoptedId, targetUserId, orderNumber, amount, status, createdAt)) {
                counters[1]++;
                return adoptedId;
            }

            targetIdsByOrderNumber.remove(orderNumber);
        }

        counters[0]++;
        return targetGateway.insertOrder(targetUserId, orderNumber, amount, status, createdAt);
    }

    private <T> void requireValue(T value, String field, String orderNumber) {
        if (value == null) {
            throw new MigrationException("У заказа '" + orderNumber + "' отсутствует обязательное поле " + field);
        }
    }
}

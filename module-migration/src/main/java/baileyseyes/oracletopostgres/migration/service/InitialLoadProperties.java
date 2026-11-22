package baileyseyes.oracletopostgres.migration.service;

import static lombok.AccessLevel.PRIVATE;

import java.util.List;
import java.util.Map;
import lombok.Data;
import lombok.experimental.FieldDefaults;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Настройки быстрой первичной загрузки на время остановки окружения.
 */
@Data
@FieldDefaults(level = PRIVATE)
@ConfigurationProperties(prefix = "migration.initial-load")
public class InitialLoadProperties {

    /**
     * Размер чанка для чтения Oracle и одного COPY в PostgreSQL.
     */
    int chunkSize = 50000;

    /**
     * Очистить target-таблицы перед началом загрузки.
     */
    boolean truncateTarget = false;

    /**
     * Продолжить прерванную загрузку с {@code MAX(id)} в target.
     */
    boolean resume = false;

    /**
     * Заполнить {@code migration_entity_map} после загрузки
     * для последующего mirror-режима.
     */
    boolean populateMapping = false;

    /**
     * Выполнить validation source vs target после загрузки.
     */
    boolean validate = true;

    /**
     * Требовать отсутствия активных пользовательских сессий
     * в схеме источника.
     */
    boolean requireSourceIdle = true;

    /**
     * Попытаться зафиксировать SCN источника на старте загрузки.
     */
    boolean captureSourceScn = true;

    /**
     * SQL-скрипт, выполняемый до загрузки (например, удаление индексов и FK).
     */
    String preLoadSql;

    /**
     * SQL-скрипт, выполняемый после загрузки
     * (например, восстановление индексов и FK).
     */
    String postLoadSql;

    /**
     * Дополнительные source-таблицы для generic-загрузки.
     * Пусто — все, кроме users/orders и excluded-tables.
     */
    List<String> includeTables = List.of();

    /**
     * Source-таблицы, исключаемые из generic-загрузки.
     */
    List<String> excludeTables = List.of();

    /**
     * Явное сопоставление source-таблицы с target-таблицей.
     */
    Map<String, String> tableMapping = Map.of();

    /**
     * Сопоставление source-колонок с target-колонками по таблицам:
     * {@code source table -> (source column -> target column)}.
     */
    Map<String, Map<String, String>> columnMapping = Map.of();

    /**
     * Размер чанка для таблиц с CLOB/BLOB.
     */
    int lobChunkSize = 10;

    /**
     * Число параллельных диапазонов на одну таблицу.
     * <br>
     * Требует достаточного размера source/target Hikari pool.
     */
    int workers = 4;

    /**
     * Максимальное число попыток для одного COPY-чанка.
     */
    int retryMaxAttempts = 3;

    /**
     * Начальная пауза между retry, мс.
     */
    long retryInitialBackoffMs = 500;

    /**
     * Максимальная пауза между retry, мс.
     */
    long retryMaxBackoffMs = 5000;

    /**
     * Выполнить {@code VACUUM (ANALYZE)} после загрузки.
     * <br>
     * Для insert-only загрузки обычно не обязателен, но обновляет visibility map.
     */
    boolean vacuum = false;

    /**
     * Выполнить {@code ANALYZE} после загрузки.
     */
    boolean analyze = true;
}

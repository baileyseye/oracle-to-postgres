package baileyseyes.oracletopostgres.migration.service;

import baileyseyes.oracletopostgres.migration.common.exception.MigrationException;
import java.util.Locale;

/**
 * Режим работы сервиса миграции.
 */
public enum MigrationMode {

    /**
     * Зеркальная синхронизация Oracle → PostgreSQL по source id.
     */
    MIRROR,

    /**
     * Быстрая первичная загрузка на время остановки окружения.
     */
    INITIAL_LOAD;

    /**
     * Разбирает значение режима из конфигурации.
     * <br>
     * По умолчанию используется {@code initial-load} — миграция
     * с остановкой окружения. Альтернативный режим {@code mirror} предназначен
     * для зеркальной синхронизации без остановки. Также допустимы
     * {@code initial_load} и {@code downtime}.
     */
    public static MigrationMode from(String value) {
        String normalized = value == null
            ? "initial-load"
            : value.trim().toLowerCase(Locale.ROOT).replace('_', '-');

        return switch (normalized) {
            case "mirror" -> MIRROR;
            case "initial-load", "initial", "downtime" -> INITIAL_LOAD;
            default -> throw new MigrationException("Неизвестный режим миграции '" + value
                + "'. Допустимые значения: mirror, initial-load");
        };
    }
}

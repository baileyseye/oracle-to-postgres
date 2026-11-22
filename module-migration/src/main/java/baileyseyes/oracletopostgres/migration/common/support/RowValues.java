package baileyseyes.oracletopostgres.migration.common.support;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.Map;

/**
 * Извлечение значений из строки, прочитанной через JDBC.
 * <br>
 * Oracle возвращает имена колонок в верхнем регистре, поэтому поиск выполняется без учёта регистра.
 */
public final class RowValues {

    private RowValues() {
    }

    /**
     * Возвращает значение колонки без учёта регистра её имени.
     */
    public static Object get(Map<String, Object> row, String column) {
        return row.entrySet().stream()
            .filter(entry -> entry.getKey().equalsIgnoreCase(column))
            .map(Map.Entry::getValue)
            .findFirst()
            .orElse(null);
    }

    /**
     * Приводит значение колонки к строке.
     */
    public static String asString(Map<String, Object> row, String column) {
        Object value = get(row, column);
        return value == null ? null : value.toString();
    }

    /**
     * Приводит числовое значение Oracle (обычно {@link BigDecimal}) к {@link Long}.
     */
    public static Long asLong(Map<String, Object> row, String column) {
        Object value = get(row, column);

        if (value == null) {
            return null;
        }

        if (value instanceof Number number) {
            return number.longValue();
        }

        return Long.valueOf(value.toString());
    }

    /**
     * Приводит числовое значение Oracle к {@link BigDecimal}.
     */
    public static BigDecimal asBigDecimal(Map<String, Object> row, String column) {
        Object value = get(row, column);

        if (value == null) {
            return null;
        }

        if (value instanceof BigDecimal decimal) {
            return decimal;
        }

        return new BigDecimal(value.toString());
    }

    /**
     * Приводит временное значение Oracle к {@link LocalDateTime}.
     */
    public static LocalDateTime asLocalDateTime(Map<String, Object> row, String column) {
        Object value = get(row, column);

        if (value == null) {
            return null;
        }

        if (value instanceof LocalDateTime dateTime) {
            return dateTime;
        }

        if (value instanceof Timestamp timestamp) {
            return timestamp.toLocalDateTime();
        }

        if (value instanceof java.util.Date date) {
            return LocalDateTime.ofInstant(date.toInstant(), ZoneId.systemDefault());
        }

        String text = value.toString();

        try {
            return LocalDateTime.parse(text);
        } catch (DateTimeParseException exception) {
            return Timestamp.valueOf(text).toLocalDateTime();
        }
    }
}

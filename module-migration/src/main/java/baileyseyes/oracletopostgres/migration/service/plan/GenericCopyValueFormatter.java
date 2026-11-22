package baileyseyes.oracletopostgres.migration.service.plan;

import baileyseyes.oracletopostgres.migration.common.exception.MigrationException;
import java.math.BigDecimal;
import java.sql.Blob;
import java.sql.Clob;
import java.sql.SQLXML;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.Date;
import java.util.HexFormat;
import java.util.Locale;
import org.springframework.stereotype.Component;

/**
 * Форматирует значение Oracle в поле CSV для PostgreSQL COPY.
 * <br>
 * Все не-null значения передаются в кавычках: PostgreSQL корректно разбирает
 * числа, даты, boolean и bytea в кавычках, а кавычки защищают
 * от запятых и переводов строк.
 * {@code null} передаётся пустым полем (в COPY задано {@code NULL ''}).
 */
@Component
public class GenericCopyValueFormatter {

    public String format(Object value, TableColumnPlan column) {
        if (value == null) {
            return "";
        }

        String typeName = column.targetTypeName() == null
            ? ""
            : column.targetTypeName().toLowerCase(Locale.ROOT);

        Object normalized = normalize(value, typeName);
        return quote(String.valueOf(normalized));
    }

    private Object normalize(Object value, String targetType) {
        if (value instanceof byte[] bytes) {
            return "\\x" + HexFormat.of().formatHex(bytes);
        }

        if (value instanceof Clob clob) {
            return readClob(clob);
        }

        if (value instanceof Blob blob) {
            return "\\x" + HexFormat.of().formatHex(readBlob(blob));
        }

        if (value instanceof SQLXML sqlxml) {
            return readSqlXml(sqlxml);
        }

        if (value instanceof java.sql.Array || value instanceof java.sql.Struct
            || value instanceof java.sql.Ref) {
            throw new MigrationException("Тип " + value.getClass().getName()
                + " не поддерживается generic initial-load; "
                + "нужна отдельная трансформация");
        }

        if (isBoolean(targetType)) {
            return booleanValue(value);
        }

        if (value instanceof LocalDateTime dateTime) {
            return Timestamp.valueOf(dateTime).toString();
        }

        if (value instanceof LocalDate || value instanceof LocalTime
            || value instanceof OffsetDateTime
            || value instanceof java.sql.Date || value instanceof java.sql.Time) {
            return value.toString();
        }

        if (value instanceof Date date) {
            return new Timestamp(date.getTime()).toString();
        }

        if (value instanceof BigDecimal decimal) {
            return decimal.toPlainString();
        }

        if (value instanceof Boolean || value instanceof Number) {
            return value.toString();
        }

        return value;
    }

    private String booleanValue(Object value) {
        if (value instanceof Boolean bool) {
            return bool.toString();
        }

        if (value instanceof Number number) {
            return number.intValue() == 0 ? "false" : "true";
        }

        String text = value.toString().trim().toLowerCase(Locale.ROOT);

        if ("0".equals(text) || "false".equals(text)) {
            return "false";
        }

        if ("1".equals(text) || "true".equals(text)) {
            return "true";
        }

        throw new MigrationException("Значение '" + value + "' не приводится к boolean");
    }

    private String readClob(Clob clob) {
        try {
            long length = clob.length();

            if (length > Integer.MAX_VALUE) {
                throw new MigrationException(
                    "CLOB больше 2 ГБ не поддерживается одним значением");
            }

            return clob.getSubString(1, (int) length);
        } catch (Exception exception) {
            throw new MigrationException("Не удалось прочитать CLOB", exception);
        }
    }

    private byte[] readBlob(Blob blob) {
        try {
            long length = blob.length();

            if (length > Integer.MAX_VALUE) {
                throw new MigrationException(
                    "BLOB больше 2 ГБ не поддерживается одним значением");
            }

            return blob.getBytes(1, (int) length);
        } catch (Exception exception) {
            throw new MigrationException("Не удалось прочитать BLOB", exception);
        }
    }

    private String readSqlXml(SQLXML sqlxml) {
        try {
            return sqlxml.getString();
        } catch (Exception exception) {
            throw new MigrationException("Не удалось прочитать SQLXML", exception);
        }
    }

    private boolean isBoolean(String targetType) {
        return targetType.equals("bool") || targetType.equals("boolean");
    }

    private String quote(String value) {
        return "\"" + value.replace("\"", "\"\"") + "\"";
    }
}

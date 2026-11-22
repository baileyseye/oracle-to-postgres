package baileyseyes.oracletopostgres.migration.service;

import baileyseyes.oracletopostgres.migration.common.support.ColumnMetadata;
import baileyseyes.oracletopostgres.migration.common.support.SchemaIssueSeverity;
import java.sql.Types;
import java.util.Locale;
import java.util.Optional;

/**
 * Проверка совместимости Oracle-типа и PostgreSQL-типа с учётом допустимых
 * преобразований. Это не текстовое сравнение имён типов, а проверка по JDBC-типу,
 * размеру, precision и scale.
 */
public final class SchemaTypeCompatibility {

    private SchemaTypeCompatibility() {
    }

    public static Optional<TypeCheckResult> check(ColumnMetadata source, ColumnMetadata target) {
        if (source.jdbcType() == target.jdbcType()) {
            return checkSameFamily(source, target);
        }

        boolean sourceNumeric = isNumeric(source.jdbcType());
        boolean targetNumeric = isNumeric(target.jdbcType());
        boolean sourceCharacter = isCharacter(source.jdbcType()) || isLobText(source.jdbcType());
        boolean targetCharacter = isCharacter(target.jdbcType()) || isLobText(target.jdbcType());
        boolean sourceBinary = isBinary(source.jdbcType());
        boolean targetBinary = isBinary(target.jdbcType());
        boolean sourceDateTime = isDateTime(source.jdbcType());
        boolean targetDateTime = isDateTime(target.jdbcType());

        if (sourceNumeric && targetNumeric) {
            return checkNumeric(source, target);
        }

        if (sourceNumeric && isBoolean(target.jdbcType())
            && source.decimalDigits() == 0 && source.size() <= 1) {
            return Optional.empty();
        }

        if (isBoolean(source.jdbcType()) && targetNumeric
            && target.decimalDigits() == 0 && target.size() <= 1) {
            return Optional.empty();
        }

        if (isBoolean(source.jdbcType()) && isBoolean(target.jdbcType())) {
            return Optional.empty();
        }

        if (sourceCharacter && targetCharacter) {
            return checkCharacter(source, target);
        }

        if (sourceBinary && targetBinary) {
            return checkBinary(source, target);
        }

        if (sourceDateTime && targetDateTime) {
            return checkDateTime(source, target);
        }

        return Optional.of(error(
            "Несовместимые типы: Oracle " + describe(source) + " → PostgreSQL " + describe(target),
            source,
            target));
    }

    private static Optional<TypeCheckResult> checkSameFamily(ColumnMetadata source, ColumnMetadata target) {
        if (isNumeric(source.jdbcType())) {
            return checkNumeric(source, target);
        }

        if (isCharacter(source.jdbcType()) || isLobText(source.jdbcType())) {
            return checkCharacter(source, target);
        }

        if (isBinary(source.jdbcType())) {
            return checkBinary(source, target);
        }

        return Optional.empty();
    }

    private static Optional<TypeCheckResult> checkNumeric(ColumnMetadata source, ColumnMetadata target) {
        if (isFloating(source.jdbcType()) || isFloating(target.jdbcType())) {
            return Optional.of(warning(
                "Floating-point тип может потерять точность: Oracle " + describe(source)
                    + " → PostgreSQL " + describe(target),
                source,
                target));
        }

        if (source.size() <= 0) {
            return Optional.of(warning(
                "У исходного NUMERIC не задана precision; совместимость проверена частично",
                source,
                target));
        }

        if (source.decimalDigits() == 0) {
            if (target.decimalDigits() > 0) {
                return Optional.empty();
            }

            if (target.size() > 0 && target.size() < source.size()) {
                return Optional.of(error(
                    "Целевой тип уже: precision " + target.size() + " < " + source.size(),
                    source,
                    target));
            }

            return Optional.empty();
        }

        if (target.decimalDigits() < source.decimalDigits()) {
            return Optional.of(error(
                "Целевой scale меньше: " + target.decimalDigits() + " < " + source.decimalDigits(),
                source,
                target));
        }

        if (target.size() > 0 && target.size() < source.size()) {
            return Optional.of(error(
                "Целевая precision меньше: " + target.size() + " < " + source.size(),
                source,
                target));
        }

        return Optional.empty();
    }

    private static Optional<TypeCheckResult> checkCharacter(ColumnMetadata source, ColumnMetadata target) {
        if (isLobText(target.jdbcType()) || target.size() <= 0) {
            return Optional.empty();
        }

        if (source.size() > 0 && target.size() < source.size()) {
            return Optional.of(error(
                "Целевая длина строки меньше: " + target.size() + " < " + source.size(),
                source,
                target));
        }

        return Optional.empty();
    }

    private static Optional<TypeCheckResult> checkBinary(ColumnMetadata source, ColumnMetadata target) {
        if (target.size() <= 0 || source.size() <= 0) {
            return Optional.empty();
        }

        if (target.size() < source.size()) {
            return Optional.of(error(
                "Целевая длина binary меньше: " + target.size() + " < " + source.size(),
                source,
                target));
        }

        return Optional.empty();
    }

    private static Optional<TypeCheckResult> checkDateTime(ColumnMetadata source, ColumnMetadata target) {
        if (source.jdbcType() == Types.TIMESTAMP && target.jdbcType() == Types.DATE) {
            return Optional.of(error(
                "Oracle DATE/TIMESTAMP содержит время; PostgreSQL DATE его потеряет",
                source,
                target));
        }

        if (source.jdbcType() == Types.TIMESTAMP_WITH_TIMEZONE
            && target.jdbcType() == Types.TIMESTAMP) {
            return Optional.of(warning(
                "Целевой TIMESTAMP не хранит time zone",
                source,
                target));
        }

        return Optional.empty();
    }

    private static boolean isBoolean(int jdbcType) {
        return jdbcType == Types.BOOLEAN || jdbcType == Types.BIT;
    }

    private static boolean isNumeric(int jdbcType) {
        return switch (jdbcType) {
            case Types.NUMERIC, Types.DECIMAL, Types.BIGINT, Types.INTEGER,
                 Types.SMALLINT, Types.TINYINT, Types.FLOAT, Types.REAL, Types.DOUBLE -> true;
            default -> false;
        };
    }

    private static boolean isFloating(int jdbcType) {
        return switch (jdbcType) {
            case Types.FLOAT, Types.REAL, Types.DOUBLE -> true;
            default -> false;
        };
    }

    private static boolean isCharacter(int jdbcType) {
        return switch (jdbcType) {
            case Types.CHAR, Types.VARCHAR, Types.LONGVARCHAR,
                 Types.NCHAR, Types.NVARCHAR, Types.LONGNVARCHAR -> true;
            default -> false;
        };
    }

    private static boolean isLobText(int jdbcType) {
        return jdbcType == Types.CLOB || jdbcType == Types.NCLOB;
    }

    private static boolean isBinary(int jdbcType) {
        return switch (jdbcType) {
            case Types.BINARY, Types.VARBINARY, Types.LONGVARBINARY, Types.BLOB -> true;
            default -> false;
        };
    }

    private static boolean isDateTime(int jdbcType) {
        return switch (jdbcType) {
            case Types.DATE, Types.TIME, Types.TIMESTAMP,
                 Types.TIME_WITH_TIMEZONE, Types.TIMESTAMP_WITH_TIMEZONE -> true;
            default -> false;
        };
    }

    private static TypeCheckResult error(String message, ColumnMetadata source, ColumnMetadata target) {
        return new TypeCheckResult(SchemaIssueSeverity.ERROR, message, describe(source), describe(target));
    }

    private static TypeCheckResult warning(String message, ColumnMetadata source, ColumnMetadata target) {
        return new TypeCheckResult(SchemaIssueSeverity.WARNING, message, describe(source), describe(target));
    }

    private static String describe(ColumnMetadata column) {
        String typeName = column.typeName() == null ? "" : column.typeName().toLowerCase(Locale.ROOT);
        return typeName + "(" + column.size() + "," + column.decimalDigits() + ")";
    }

    /**
     * Результат проверки типа.
     */
    public record TypeCheckResult(SchemaIssueSeverity severity, String message,
                                  String sourceValue, String targetValue) {
    }
}

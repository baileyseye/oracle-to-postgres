package baileyseyes.oracletopostgres.migration.target.service;

import baileyseyes.oracletopostgres.migration.common.exception.MigrationConflictException;
import baileyseyes.oracletopostgres.migration.common.exception.MigrationException;
import baileyseyes.oracletopostgres.migration.common.exception.TargetAccessException;
import baileyseyes.oracletopostgres.migration.common.support.RowValues;
import baileyseyes.oracletopostgres.migration.service.plan.GenericCopyValueFormatter;
import baileyseyes.oracletopostgres.migration.service.plan.InitialLoadTablePlan;
import baileyseyes.oracletopostgres.migration.service.plan.TableColumnPlan;
import baileyseyes.oracletopostgres.migration.target.config.MigrationTargetProperties;
import java.io.IOException;
import java.io.StringReader;
import java.sql.SQLException;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.postgresql.PGConnection;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * Запись generic-таблиц в PostgreSQL через COPY и синхронизация sequences.
 */
@Slf4j
@Service
public class GenericInitialLoadTargetGateway {

    private static final Pattern IDENTIFIER = Pattern.compile("[A-Za-z_][A-Za-z0-9_]*");

    private final JdbcTemplate targetJdbcTemplate;
    private final String schema;
    private final GenericCopyValueFormatter formatter;

    public GenericInitialLoadTargetGateway(@Qualifier("targetJdbcTemplate") JdbcTemplate targetJdbcTemplate,
                                           MigrationTargetProperties properties,
                                           GenericCopyValueFormatter formatter) {
        this.targetJdbcTemplate = targetJdbcTemplate;
        this.schema = properties.getSchema();
        this.formatter = formatter;
    }

    public void truncateTables(List<String> tables) {
        if (tables.isEmpty()) {
            return;
        }

        String tableList = tables.stream()
            .map(this::qualifiedTable)
            .collect(Collectors.joining(", "));

        try {
            targetJdbcTemplate.execute("TRUNCATE TABLE " + tableList + " RESTART IDENTITY");
        } catch (DataAccessException exception) {
            throw new TargetAccessException("Не удалось очистить generic target-таблицы", exception);
        }
    }

    public boolean isEmpty(String table) {
        try {
            Boolean exists = targetJdbcTemplate.queryForObject(
                "SELECT EXISTS (SELECT 1 FROM " + qualifiedTable(table) + ")", Boolean.class);
            return !Boolean.TRUE.equals(exists);
        } catch (DataAccessException exception) {
            throw new TargetAccessException("Не удалось проверить пустоту таблицы '"
                + table + "'", exception);
        }
    }

    public long maxKey(String table, String column) {
        String columnName = identifier(column);

        try {
            Long max = targetJdbcTemplate.queryForObject(
                "SELECT MAX(" + quote(columnName) + ") FROM " + qualifiedTable(table), Long.class);

            return max == null ? Long.MIN_VALUE : max;
        } catch (DataAccessException exception) {
            throw new TargetAccessException("Не удалось прочитать MAX(" + column + ") таблицы '"
                + table + "'", exception);
        }
    }

    public long maxKeyBetween(String table, String column, long from, long to) {
        String columnName = identifier(column);

        try {
            Long max = targetJdbcTemplate.queryForObject(
                "SELECT MAX(" + quote(columnName) + ") FROM " + qualifiedTable(table)
                    + " WHERE " + quote(columnName) + " BETWEEN ? AND ?",
                Long.class, from, to);

            return max == null ? Long.MIN_VALUE : max;
        } catch (DataAccessException exception) {
            throw new TargetAccessException("Не удалось прочитать MAX(" + column + ") таблицы '"
                + table + "' в диапазоне", exception);
        }
    }

    /**
     * Загружает чанк строк через COPY.
     */
    public long copyRows(InitialLoadTablePlan plan, List<Map<String, Object>> rows) {
        StringBuilder csv = new StringBuilder(rows.size() * 160);

        for (Map<String, Object> row : rows) {
            for (int index = 0; index < plan.columns().size(); index++) {
                if (index > 0) {
                    csv.append(',');
                }

                TableColumnPlan column = plan.columns().get(index);
                Object value = RowValues.get(row, column.sourceColumn());
                csv.append(formatter.format(value, column));
            }

            csv.append('\n');
        }

        String columns = plan.columns().stream()
            .map(column -> quote(column.targetColumn()))
            .collect(Collectors.joining(", "));

        return copy(plan.targetTable(), columns, csv);
    }

    /**
     * Синхронизирует identity и nextval-default sequences таблицы после загрузки.
     */
    public void restartSequences(String table) {
        String schemaFilter = schema == null || schema.isBlank() ? null : schema;
        List<SequenceColumn> columns = targetJdbcTemplate.query(
            "SELECT column_name, column_default, is_identity"
                + " FROM information_schema.columns"
                + " WHERE table_schema = COALESCE(?, current_schema()) AND table_name = ?"
                + " AND (is_identity = 'YES' OR column_default LIKE 'nextval(%')"
                + " ORDER BY ordinal_position",
            (resultSet, rowNumber) -> new SequenceColumn(
                resultSet.getString("column_name"),
                resultSet.getString("column_default"),
                "YES".equalsIgnoreCase(resultSet.getString("is_identity"))),
            schemaFilter, table.toLowerCase(Locale.ROOT));

        for (SequenceColumn column : columns) {
            long max = maxKey(table, column.columnName());
            long next = max == Long.MIN_VALUE ? 1 : max + 1;

            if (column.identity()) {
                targetJdbcTemplate.execute("ALTER TABLE " + qualifiedTable(table)
                    + " ALTER COLUMN " + quote(column.columnName()) + " RESTART WITH " + next);
                continue;
            }

            String sequence = parseSequence(column.defaultValue());

            if (sequence == null) {
                log.warn("Не удалось разобрать sequence default '{}' для {}.{}",
                    column.defaultValue(), table, column.columnName());
                continue;
            }

            targetJdbcTemplate.queryForObject(
                "SELECT setval(?::regclass, ?, false)", Long.class, sequence, next);
        }
    }

    public void analyze(String table) {
        try {
            targetJdbcTemplate.execute("ANALYZE " + qualifiedTable(table));
        } catch (DataAccessException exception) {
            throw new TargetAccessException("Не удалось выполнить ANALYZE таблицы '"
                + table + "'", exception);
        }
    }

    public void vacuum(String table) {
        try {
            targetJdbcTemplate.execute("VACUUM (ANALYZE) " + qualifiedTable(table));
        } catch (DataAccessException exception) {
            throw new TargetAccessException("Не удалось выполнить VACUUM таблицы '"
                + table + "'", exception);
        }
    }

    private long copy(String table, String columns, CharSequence data) {
        String sql = "COPY " + qualifiedTable(table) + " (" + columns + ")"
            + " FROM STDIN WITH (FORMAT csv, NULL '')";

        try {
            Long copied = targetJdbcTemplate.execute((ConnectionCallback<Long>) connection -> {
                try {
                    PGConnection pgConnection = connection.unwrap(PGConnection.class);
                    return pgConnection.getCopyAPI().copyIn(sql, new StringReader(data.toString()));
                } catch (IOException exception) {
                    throw new SQLException("Не удалось прочитать CSV для COPY", exception);
                }
            });

            return copied == null ? 0 : copied;
        } catch (DataIntegrityViolationException exception) {
            throw new MigrationConflictException("COPY в таблицу '" + table
                + "' нарушает уникальность, FK или check-constraint", exception);
        } catch (DataAccessException exception) {
            throw new TargetAccessException("Не удалось выполнить COPY в таблицу '"
                + table + "'", exception);
        }
    }

    private String parseSequence(String defaultValue) {
        if (defaultValue == null) {
            return null;
        }

        int start = defaultValue.indexOf("nextval('");

        if (start < 0) {
            return null;
        }

        start += "nextval('".length();
        int end = defaultValue.indexOf("'::regclass", start);

        if (end < 0) {
            return null;
        }

        return defaultValue.substring(start, end);
    }

    private String qualifiedTable(String table) {
        String tableName = identifier(table);

        if (schema == null || schema.isBlank()) {
            return quote(tableName);
        }

        return quote(schema) + "." + quote(tableName);
    }

    private String identifier(String value) {
        if (value == null || !IDENTIFIER.matcher(value).matches()) {
            throw new MigrationException("Недопустимое имя таблицы/колонки initial-load: " + value);
        }

        return value;
    }

    private String quote(String identifier) {
        return "\"" + identifier.replace("\"", "\"\"") + "\"";
    }

    private record SequenceColumn(String columnName, String defaultValue, boolean identity) {
    }
}

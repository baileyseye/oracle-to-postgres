package baileyseyes.oracletopostgres.migration.source.oracle;

import baileyseyes.oracletopostgres.migration.common.exception.SourceAccessException;
import baileyseyes.oracletopostgres.migration.source.contract.MetadataProvider;
import baileyseyes.oracletopostgres.migration.source.contract.RowReader;
import java.sql.Date;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.sql.Time;
import java.sql.Timestamp;
import java.sql.Types;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.stereotype.Component;

/**
 * Чтение строк Oracle-источника через {@link JdbcTemplate}.
 * <br>
 * Имя таблицы никогда не берётся из запроса напрямую: оно сверяется с метаданными
 * через {@link MetadataProvider}, и в SQL подставляется каноническое имя из СУБД
 * вместе со схемой источника.
 */
@Slf4j
@Component
public class OracleRowReader implements RowReader {

    private final JdbcTemplate jdbcTemplate;
    private final MetadataProvider metadataProvider;

    public OracleRowReader(@Qualifier("sourceJdbcTemplate") JdbcTemplate jdbcTemplate,
                           MetadataProvider metadataProvider) {
        this.jdbcTemplate = jdbcTemplate;
        this.metadataProvider = metadataProvider;
    }

    @Override
    public List<Map<String, Object>> readRows(String table, int limit) {
        String qualifiedTable = metadataProvider.qualifiedTableName(table);
        int safeLimit = Math.max(limit, 1);

        String sql = "SELECT * FROM " + qualifiedTable + " WHERE ROWNUM <= ?";
        log.debug("Чтение строк таблицы {} с ограничением {}", qualifiedTable, safeLimit);

        return executeQuery(sql, table, safeLimit);
    }

    @Override
    public void forEachRow(String table, Consumer<Map<String, Object>> consumer) {
        String qualifiedTable = metadataProvider.qualifiedTableName(table);
        String sql = "SELECT * FROM " + qualifiedTable;
        log.debug("Потоковое чтение таблицы {}", qualifiedTable);

        try {
            jdbcTemplate.query(sql, (RowCallbackHandler) resultSet -> consumer.accept(mapRow(resultSet)));
        } catch (DataAccessException exception) {
            throw new SourceAccessException(
                "Не удалось прочитать строки таблицы " + table, exception);
        }
    }

    private List<Map<String, Object>> executeQuery(String sql, String table, Object... arguments) {
        try {
            List<Map<String, Object>> rows = jdbcTemplate.query(
                sql, (resultSet, _) -> mapRow(resultSet), arguments);

            return rows == null ? new ArrayList<>() : rows;
        } catch (DataAccessException exception) {
            throw new SourceAccessException(
                "Не удалось прочитать строки таблицы " + table, exception);
        }
    }

    private Map<String, Object> mapRow(ResultSet resultSet) throws SQLException {
        ResultSetMetaData metaData = resultSet.getMetaData();
        int columnCount = metaData.getColumnCount();
        Map<String, Object> row = LinkedHashMap.newLinkedHashMap(columnCount);

        for (int index = 1; index <= columnCount; index++) {
            row.put(metaData.getColumnLabel(index), readValue(resultSet, metaData.getColumnType(index), index));
        }

        return row;
    }

    /**
     * Приводит Oracle-специфичные JDBC-типы к обычным Java-типам, которые корректно
     * сериализуются в JSON и не зависят от реализации драйвера.
     */
    private Object readValue(ResultSet resultSet, int sqlType, int index) throws SQLException {
        return switch (sqlType) {
            case Types.TIMESTAMP -> toLocalDateTime(resultSet.getTimestamp(index));
            case Types.TIMESTAMP_WITH_TIMEZONE -> resultSet.getString(index);
            case Types.DATE -> toLocalDate(resultSet.getDate(index));
            case Types.TIME -> toLocalTime(resultSet.getTime(index));
            case Types.CLOB, Types.NCLOB, Types.LONGVARCHAR -> resultSet.getString(index);
            case Types.BLOB, Types.LONGVARBINARY -> resultSet.getBytes(index);
            default -> resultSet.getObject(index);
        };
    }

    private LocalDateTime toLocalDateTime(Timestamp value) {
        return value == null ? null : value.toLocalDateTime();
    }

    private LocalDate toLocalDate(Date value) {
        return value == null ? null : value.toLocalDate();
    }

    private LocalTime toLocalTime(Time value) {
        return value == null ? null : value.toLocalTime();
    }
}

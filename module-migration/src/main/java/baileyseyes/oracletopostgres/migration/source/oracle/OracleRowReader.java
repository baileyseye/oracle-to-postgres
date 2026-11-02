package baileyseyes.oracletopostgres.migration.source.oracle;

import baileyseyes.oracletopostgres.migration.common.exception.SourceAccessException;
import baileyseyes.oracletopostgres.migration.source.contract.MetadataProvider;
import baileyseyes.oracletopostgres.migration.source.contract.RowReader;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Чтение строк Oracle-источника через {@link JdbcTemplate}.
 * <br>
 * Имя таблицы никогда не берётся из запроса напрямую: оно сверяется с метаданными
 * через {@link MetadataProvider}, и в SQL подставляется каноническое имя из СУБД.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OracleRowReader implements RowReader {

    private final JdbcTemplate jdbcTemplate;
    private final MetadataProvider metadataProvider;

    @Override
    public List<Map<String, Object>> readRows(String table, int limit) {
        String resolvedTable = metadataProvider.resolveTableName(table);
        int safeLimit = Math.max(limit, 1);

        String sql = "SELECT * FROM " + quote(resolvedTable) + " WHERE ROWNUM <= ?";
        log.debug("Чтение строк таблицы {} с ограничением {}", resolvedTable, safeLimit);

        try {
            List<Map<String, Object>> rows = jdbcTemplate.query(
                sql, (resultSet, _) -> {
                    int columnCount = resultSet.getMetaData().getColumnCount();
                    Map<String, Object> row = LinkedHashMap.newLinkedHashMap(columnCount);

                    for (int index = 1; index <= columnCount; index++) {
                        row.put(resultSet.getMetaData().getColumnLabel(index), resultSet.getObject(index));
                    }

                    return row;
                },
                safeLimit
            );

            return rows == null ? new ArrayList<>() : rows;
        } catch (RuntimeException exception) {
            throw new SourceAccessException("Не удалось прочитать строки таблицы " + resolvedTable, exception);
        }
    }

    private String quote(String table) {
        return "\"" + table.replace("\"", "\"\"") + "\"";
    }
}

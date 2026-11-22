package baileyseyes.oracletopostgres.schema.target.service;

import baileyseyes.oracletopostgres.schema.common.exception.TargetAccessException;
import baileyseyes.oracletopostgres.schema.target.config.SchemaTargetProperties;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import javax.sql.DataSource;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;

@Component
public class PostgresTargetInspector {

    private final DataSource schemaTargetDataSource;
    private final SchemaTargetProperties properties;

    public PostgresTargetInspector(@Qualifier("schemaTargetDataSource") DataSource schemaTargetDataSource,
                                   SchemaTargetProperties properties) {
        this.schemaTargetDataSource = schemaTargetDataSource;
        this.properties = properties;
    }

    public PostgresTargetSnapshot snapshot() {
        try (Connection connection = schemaTargetDataSource.getConnection()) {
            String schema = properties.getSchema();
            Set<String> tables = new LinkedHashSet<>();

            try (ResultSet resultSet = connection.getMetaData()
                .getTables(null, schema, "%", new String[]{"TABLE"})) {
                while (resultSet.next()) {
                    tables.add(resultSet.getString("TABLE_NAME").toLowerCase(Locale.ROOT));
                }
            }

            Map<String, Set<String>> columns = new LinkedHashMap<>();

            for (String table : tables) {
                columns.put(table, readColumns(connection, schema, table));
            }

            return new PostgresTargetSnapshot(schema, tables, columns);
        } catch (SQLException exception) {
            throw new TargetAccessException("Не удалось прочитать target-схему", exception);
        }
    }

    private Set<String> readColumns(Connection connection, String schema, String table)
        throws SQLException {
        Set<String> columns = new LinkedHashSet<>();

        try (ResultSet resultSet = connection.getMetaData().getColumns(null, schema, table, "%")) {
            while (resultSet.next()) {
                columns.add(resultSet.getString("COLUMN_NAME").toLowerCase(Locale.ROOT));
            }
        }

        return columns;
    }
}

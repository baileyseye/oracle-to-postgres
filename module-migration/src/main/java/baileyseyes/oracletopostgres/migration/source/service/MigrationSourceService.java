package baileyseyes.oracletopostgres.migration.source.service;

import baileyseyes.oracletopostgres.migration.source.config.MigrationSourceProperties;
import baileyseyes.oracletopostgres.migration.source.contract.MetadataProvider;
import baileyseyes.oracletopostgres.migration.source.contract.RowReader;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Оркестрация доступа к источнику миграции: контроллеры работают только с этим сервисом
 * и не знают, какая СУБД стоит за контрактами.
 */
@Service
@RequiredArgsConstructor
public class MigrationSourceService {

    private final MetadataProvider metadataProvider;
    private final RowReader rowReader;
    private final MigrationSourceProperties properties;

    public List<String> listTables() {
        return metadataProvider.listTables();
    }

    public List<String> listColumns(String table) {
        return metadataProvider.listColumns(table);
    }

    public List<Map<String, Object>> readRows(String table) {
        return rowReader.readRows(table, properties.getRowLimit());
    }
}

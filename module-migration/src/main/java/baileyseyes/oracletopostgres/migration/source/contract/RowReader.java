package baileyseyes.oracletopostgres.migration.source.contract;

import java.util.List;
import java.util.Map;

/**
 * Контракт построчного чтения данных из источника миграции.
 */
public interface RowReader {

    /**
     * Читает строки таблицы в виде «колонка → значение».
     *
     * @param table имя таблицы; должно быть предварительно проверено через {@link MetadataProvider}
     * @param limit максимальное число возвращаемых строк
     */
    List<Map<String, Object>> readRows(String table, int limit);
}

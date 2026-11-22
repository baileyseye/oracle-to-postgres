package baileyseyes.oracletopostgres.migration.source.contract;

import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

/**
 * Контракт построчного чтения данных из источника миграции.
 */
public interface RowReader {

    /**
     * Читает строки таблицы в виде «колонка → значение».
     *
     * @param table имя таблицы; должно быть предварительно проверено
     *              через {@link MetadataProvider}
     * @param limit максимальное число возвращаемых строк
     */
    List<Map<String, Object>> readRows(String table, int limit);

    /**
     * Читает очередную страницу таблицы после указанного значения ключа.
     * <br>
     * Keyset-пагинация не требует загружать таблицу целиком и позволяет обрабатывать
     * сотни миллионов строк с памятью, ограниченной размером страницы.
     *
     * @param table     имя таблицы; должно быть предварительно проверено
     *                  через {@link MetadataProvider}
     * @param keyColumn колонка с монотонным ключом, по которой строится страница
     * @param afterKey  последнее уже обработанное значение ключа
     * @param limit     максимальное число строк в странице
     */
    List<Map<String, Object>> readRowsAfter(String table, String keyColumn, long afterKey, int limit);

    /**
     * Читает страницу в диапазоне {@code afterKey < key <= maxKey} с проекцией колонок.
     */
    List<Map<String, Object>> readRowsAfter(String table, String keyColumn, long afterKey, long maxKey,
                                            int limit, List<String> columns);

    /**
     * Возвращает минимальное значение ключа таблицы
     * или {@link Long#MIN_VALUE} для пустой таблицы.
     */
    long minKey(String table, String keyColumn);

    /**
     * Возвращает максимальное значение ключа таблицы
     * или {@link Long#MIN_VALUE} для пустой таблицы.
     */
    long maxKey(String table, String keyColumn);

    /**
     * Передаёт строки с проекцией колонок потребителю по одной,
     * не загружая всю таблицу в память.
     */
    void forEachRow(String table, List<String> columns, Consumer<Map<String, Object>> consumer);
}

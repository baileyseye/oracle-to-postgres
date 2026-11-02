package baileyseyes.oracletopostgres.migration.source.contract;

import java.util.List;

/**
 * Контракт поставщика метаданных источника миграции.
 * <br>
 * Реализации инкапсулируют конкретную СУБД; вызывающий код работает только с этим интерфейсом.
 */
public interface MetadataProvider {

    /**
     * Возвращает имена таблиц, доступных для миграции, в детерминированном порядке.
     */
    List<String> listTables();

    /**
     * Возвращает имена колонок указанной таблицы в порядке их объявления в СУБД.
     *
     * @param table имя таблицы; регистр не важен
     */
    List<String> listColumns(String table);

    /**
     * Проверяет, что таблица присутствует в источнике и разрешена к чтению.
     *
     * @param table имя таблицы; регистр не важен
     * @return имя таблицы в том регистре, в котором его хранит СУБД
     */
    String resolveTableName(String table);
}

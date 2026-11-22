package baileyseyes.oracletopostgres.migration.source.contract;

import baileyseyes.oracletopostgres.migration.common.support.CheckConstraintMetadata;
import baileyseyes.oracletopostgres.migration.common.support.ColumnMetadata;
import baileyseyes.oracletopostgres.migration.common.support.ForeignKeyMetadata;
import baileyseyes.oracletopostgres.migration.common.support.IndexMetadata;
import baileyseyes.oracletopostgres.migration.common.support.PrimaryKeyMetadata;
import java.util.List;
import java.util.Optional;

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
     * Возвращает индексы таблицы в виде состава колонок и признака уникальности.
     *
     * @param table имя таблицы; регистр не важен
     */
    List<IndexMetadata> listIndexes(String table);

    /**
     * Возвращает расширенные метаданные колонок: тип, размер, nullable, default, identity.
     */
    List<ColumnMetadata> listColumnMetadata(String table);

    /**
     * Возвращает первичный ключ таблицы.
     */
    Optional<PrimaryKeyMetadata> primaryKey(String table);

    /**
     * Возвращает внешние ключи таблицы.
     */
    List<ForeignKeyMetadata> foreignKeys(String table);

    /**
     * Возвращает CHECK-constraints таблицы.
     */
    List<CheckConstraintMetadata> checkConstraints(String table);

    /**
     * Возвращает безопасное для SQL имя таблицы с квалификацией схемой источника.
     * <br>
     * Имя сверяется с метаданными и экранируется; схема берётся из конфигурации
     * или из текущего подключения.
     *
     * @param table имя таблицы; регистр не важен
     * @return имя вида {@code "SCHEMA"."TABLE"} либо {@code "TABLE"}, если схема не определена
     */
    String qualifiedTableName(String table);
}

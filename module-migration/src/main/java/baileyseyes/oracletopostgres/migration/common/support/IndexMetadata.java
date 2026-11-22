package baileyseyes.oracletopostgres.migration.common.support;

import java.util.List;

/**
 * Описание индекса без привязки к имени: имя индекса в Oracle и PostgreSQL
 * почти всегда различается, поэтому сравниваются колонки и уникальность.
 *
 * @param unique  является ли индекс уникальным
 * @param columns колонки в порядке, заданном индексом
 */
public record IndexMetadata(boolean unique, List<String> columns) {

    public IndexMetadata {
        columns = List.copyOf(columns);
    }
}

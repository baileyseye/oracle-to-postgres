package baileyseyes.oracletopostgres.migration.dto;

import static lombok.AccessLevel.PRIVATE;

import baileyseyes.oracletopostgres.migration.common.support.IndexMetadata;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

/**
 * Расхождения по одной таблице источника.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = PRIVATE)
public class TableDiff {

    /**
     * Имя таблицы в источнике.
     */
    String table;

    /**
     * Присутствует ли таблица в приёмнике.
     */
    boolean presentInTarget;

    /**
     * Колонки источника, которых нет в приёмнике.
     */
    List<String> missingColumns;

    /**
     * Индексы источника, для которых нет эквивалента в приёмнике.
     */
    List<IndexMetadata> missingIndexes;

    /**
     * Все найденные расхождения по таблице.
     */
    List<SchemaIssue> issues;
}

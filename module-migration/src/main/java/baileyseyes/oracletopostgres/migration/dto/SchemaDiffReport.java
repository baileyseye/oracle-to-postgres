package baileyseyes.oracletopostgres.migration.dto;

import static lombok.AccessLevel.PRIVATE;

import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

/**
 * Результат сравнения схемы источника и приёмника.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = PRIVATE)
public class SchemaDiffReport {

    /**
     * Схема источника; {@code (current)}, если используется текущая схема подключения.
     */
    String sourceSchema;

    /**
     * Схема приёмника; {@code (current)}, если используется текущая схема подключения.
     */
    String targetSchema;

    /**
     * Сколько таблиц источника проверено.
     */
    int checkedTables;

    /**
     * Сколько таблиц источника отсутствует в приёмнике.
     */
    int missingTables;

    /**
     * Сколько колонок отсутствует в приёмнике.
     */
    int missingColumns;

    /**
     * Сколько индексов отсутствует в приёмнике.
     */
    int missingIndexes;

    /**
     * Количество ERROR.
     */
    int errors;

    /**
     * Количество WARNING.
     */
    int warnings;

    /**
     * Количество INFO.
     */
    int infos;

    /**
     * {@code true}, если нет ERROR; при fail-on-warnings также требуется отсутствие WARNING.
     */
    boolean valid;

    /**
     * Детализация по каждой проверенной таблице.
     */
    List<TableDiff> tables;
}

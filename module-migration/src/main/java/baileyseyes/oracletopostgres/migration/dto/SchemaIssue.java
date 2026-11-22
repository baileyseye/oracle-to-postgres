package baileyseyes.oracletopostgres.migration.dto;

import static lombok.AccessLevel.PRIVATE;

import baileyseyes.oracletopostgres.migration.common.support.SchemaIssueSeverity;
import baileyseyes.oracletopostgres.migration.common.support.SchemaObjectType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

/**
 * Одно расхождение схемы.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = PRIVATE)
public class SchemaIssue {

    /**
     * Важность: ERROR блокирует validation, WARNING требует внимания, INFO — для review.
     */
    SchemaIssueSeverity severity;

    /**
     * Тип объекта: TABLE, COLUMN, PRIMARY_KEY, FOREIGN_KEY, UNIQUE, INDEX, CHECK, DEFAULT.
     */
    SchemaObjectType objectType;

    /**
     * Имя колонки, constraint или индекса.
     */
    String objectName;

    /**
     * Человекочитаемое описание расхождения.
     */
    String message;

    /**
     * Значение/описание в Oracle.
     */
    String sourceValue;

    /**
     * Значение/описание в PostgreSQL.
     */
    String targetValue;
}

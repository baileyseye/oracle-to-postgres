package baileyseyes.oracletopostgres.migration.service.plan;

/**
 * Колонка, общая для Oracle-источника и PostgreSQL-приёмника.
 */
public record TableColumnPlan(String sourceColumn,
                              String targetColumn,
                              int targetJdbcType,
                              String targetTypeName) {
}

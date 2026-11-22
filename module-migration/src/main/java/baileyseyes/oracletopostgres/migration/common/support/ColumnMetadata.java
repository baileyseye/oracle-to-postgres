package baileyseyes.oracletopostgres.migration.common.support;

public record ColumnMetadata(
    String name,
    String typeName,
    int jdbcType,
    int size,
    int decimalDigits,
    boolean nullable,
    String defaultValue,
    boolean autoIncrement
) {
}

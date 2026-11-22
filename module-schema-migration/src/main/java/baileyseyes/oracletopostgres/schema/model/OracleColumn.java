package baileyseyes.oracletopostgres.schema.model;

public record OracleColumn(
    String name,
    String typeName,
    int jdbcType,
    int size,
    int decimalDigits,
    boolean nullable,
    String defaultValue,
    boolean identity
) {
}

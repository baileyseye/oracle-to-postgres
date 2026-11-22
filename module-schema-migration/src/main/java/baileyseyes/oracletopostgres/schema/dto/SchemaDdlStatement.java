package baileyseyes.oracletopostgres.schema.dto;

public record SchemaDdlStatement(String phase, String objectType, String objectName, String sql) {
}

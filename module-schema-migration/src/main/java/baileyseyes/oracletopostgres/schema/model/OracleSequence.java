package baileyseyes.oracletopostgres.schema.model;

public record OracleSequence(String name, long startWith, long incrementBy) {
}

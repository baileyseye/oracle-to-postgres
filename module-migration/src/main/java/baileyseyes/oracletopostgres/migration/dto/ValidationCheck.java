package baileyseyes.oracletopostgres.migration.dto;

/**
 * Одна проверка validation source vs target.
 */
public record ValidationCheck(String name,
                              String sourceValue,
                              String targetValue,
                              boolean passed,
                              String message) {
}

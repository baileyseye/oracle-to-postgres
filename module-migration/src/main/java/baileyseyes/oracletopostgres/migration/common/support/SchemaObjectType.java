package baileyseyes.oracletopostgres.migration.common.support;

/**
 * Тип объекта схемы, к которому относится расхождение.
 */
public enum SchemaObjectType {
    TABLE,
    COLUMN,
    PRIMARY_KEY,
    FOREIGN_KEY,
    UNIQUE,
    INDEX,
    CHECK,
    DEFAULT
}

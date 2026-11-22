package baileyseyes.oracletopostgres.migration.common.support;

/**
 * Важность расхождения схемы.
 */
public enum SchemaIssueSeverity {

    /**
     * Миграция или приложение могут работать некорректно; validation не проходит.
     */
    ERROR,

    /**
     * Потенциальная проблема, требующая внимания, но не блокирующая validation.
     */
    WARNING,

    /**
     * Информация для ручного review, например check-constraint с диалектным выражением.
     */
    INFO
}

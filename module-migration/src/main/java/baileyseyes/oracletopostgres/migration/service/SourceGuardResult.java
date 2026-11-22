package baileyseyes.oracletopostgres.migration.service;

/**
 * Результат preflight-проверки Oracle-источника.
 *
 * @param scn  SCN источника, если удалось получить
 * @param idle {@code true}, если активных сессий нет;
 *             {@code null}, если проверка отключена
 */
public record SourceGuardResult(Long scn, Boolean idle) {
}

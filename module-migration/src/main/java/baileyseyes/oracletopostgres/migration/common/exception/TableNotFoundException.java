package baileyseyes.oracletopostgres.migration.common.exception;

/**
 * Запрошена таблица, отсутствующая в метаданных источника или запрещённая к чтению.
 */
public class TableNotFoundException extends MigrationException {

    public TableNotFoundException(String table) {
        super("Таблица '" + table + "' отсутствует в метаданных источника");
    }
}

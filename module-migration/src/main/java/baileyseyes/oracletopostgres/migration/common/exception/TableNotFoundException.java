package baileyseyes.oracletopostgres.migration.common.exception;

import java.io.Serial;

/**
 * Запрошена таблица, отсутствующая в метаданных источника или запрещённая к чтению.
 */
public class TableNotFoundException extends MigrationException {

    @Serial
    private static final long serialVersionUID = 1L;

    public TableNotFoundException(String table) {
        super("Таблица '" + table + "' отсутствует в метаданных источника");
    }
}

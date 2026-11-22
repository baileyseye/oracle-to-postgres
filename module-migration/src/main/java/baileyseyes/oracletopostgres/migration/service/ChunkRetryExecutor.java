package baileyseyes.oracletopostgres.migration.service;

import baileyseyes.oracletopostgres.migration.common.exception.MigrationCancelledException;
import baileyseyes.oracletopostgres.migration.common.exception.MigrationConflictException;
import baileyseyes.oracletopostgres.migration.common.exception.MigrationException;
import baileyseyes.oracletopostgres.migration.common.exception.MigrationValidationException;
import java.sql.SQLException;
import java.util.function.Supplier;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.BadSqlGrammarException;
import org.springframework.dao.RecoverableDataAccessException;
import org.springframework.dao.TransientDataAccessException;
import org.springframework.stereotype.Service;

/**
 * Повторяет COPY-чанк при transient-ошибках PostgreSQL/Oracle.
 * <br>
 * Транзакция чанка откатывается, затем операция выполняется заново.
 * Ошибки уникальности/FK/CHECK и прикладные ошибки не ретраятся.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ChunkRetryExecutor {

    private final InitialLoadProperties properties;

    public void execute(String operation, Runnable action) {
        execute(operation, () -> {
            action.run();
            return null;
        });
    }

    public <T> T execute(String operation, Supplier<T> action) {
        int maxAttempts = Math.max(properties.getRetryMaxAttempts(), 1);
        long backoff = Math.max(properties.getRetryInitialBackoffMs(), 0);
        long maxBackoff = Math.max(properties.getRetryMaxBackoffMs(), backoff);

        for (int attempt = 1; ; attempt++) {
            try {
                return action.get();
            } catch (RuntimeException exception) {
                if (attempt >= maxAttempts || !isRetryable(exception)) {
                    throw exception;
                }

                log.warn("Операция '{}' не удалась (попытка {}/{}), повтор через {} мс: {}",
                    operation, attempt, maxAttempts, backoff, exception.getMessage());

                sleep(backoff);
                backoff = Math.min(backoff * 2, maxBackoff);
            }
        }
    }

    private boolean isRetryable(Throwable throwable) {
        for (Throwable cause = throwable; cause != null; cause = cause.getCause()) {
            if (cause instanceof MigrationValidationException
                || cause instanceof MigrationCancelledException
                || cause instanceof MigrationConflictException
                || cause instanceof DataIntegrityViolationException
                || cause instanceof BadSqlGrammarException) {
                return false;
            }

            if (cause instanceof TransientDataAccessException
                || cause instanceof RecoverableDataAccessException) {
                return true;
            }

            if (cause instanceof SQLException sqlException && isTransientSqlState(sqlException.getSQLState())) {
                return true;
            }
        }

        return false;
    }

    private boolean isTransientSqlState(String sqlState) {
        if (sqlState == null) {
            return false;
        }

        return sqlState.startsWith("08")
            || sqlState.startsWith("40")
            || sqlState.startsWith("53")
            || "57P01".equals(sqlState)
            || "57P02".equals(sqlState)
            || "57P03".equals(sqlState);
    }

    private void sleep(long millis) {
        if (millis <= 0) {
            return;
        }

        try {
            Thread.sleep(millis);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new MigrationException("Повтор операции initial-load прерван", exception);
        }
    }
}

package baileyseyes.oracletopostgres.migration.service;

import baileyseyes.oracletopostgres.migration.common.exception.MigrationException;
import baileyseyes.oracletopostgres.migration.common.exception.TargetAccessException;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.core.io.support.EncodedResource;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Выполнение внешних pre/post SQL-скриптов initial-load.
 * <br>
 * Приложение не дропает индексы и FK само:
 * безопаснее подготовить скрипты из pg_dump/Liquibase
 * и выполнить их в контролируемом порядке.
 */
@Slf4j
@Service
public class InitialLoadScriptRunner {

    private final JdbcTemplate targetJdbcTemplate;
    private final TransactionTemplate targetTransactionTemplate;
    private final ResourceLoader resourceLoader;

    public InitialLoadScriptRunner(@Qualifier("targetJdbcTemplate") JdbcTemplate targetJdbcTemplate,
                                   TransactionTemplate targetTransactionTemplate,
                                   ResourceLoader resourceLoader) {
        this.targetJdbcTemplate = targetJdbcTemplate;
        this.targetTransactionTemplate = targetTransactionTemplate;
        this.resourceLoader = resourceLoader;
    }

    public void runPreLoad(String location) {
        run(location, "pre-load");
    }

    public void runPostLoad(String location) {
        run(location, "post-load");
    }

    private void run(String location, String phase) {
        if (location == null || location.isBlank()) {
            log.info("SQL-скрипт {} не задан; фаза пропущена", phase);
            return;
        }

        Resource resource = resourceLoader.getResource(location);

        if (!resource.exists()) {
            throw new MigrationException("SQL-скрипт " + phase + " не найден: " + location);
        }

        log.info("Выполняется SQL-скрипт {}: {}", phase, location);

        try {
            String content = resource.getContentAsString(StandardCharsets.UTF_8);

            if (content.startsWith("\uFEFF")) {
                content = content.substring(1);
            }

            EncodedResource encodedResource = new EncodedResource(
                new ByteArrayResource(content.getBytes(StandardCharsets.UTF_8)), StandardCharsets.UTF_8);

            targetTransactionTemplate.executeWithoutResult(status ->
                targetJdbcTemplate.execute((ConnectionCallback<Void>) connection -> {
                    ScriptUtils.executeSqlScript(connection, encodedResource);
                    return null;
                }));
        } catch (IOException exception) {
            throw new TargetAccessException(
                "Не удалось прочитать SQL-скрипт " + phase + ": " + location, exception);
        } catch (DataAccessException exception) {
            throw new TargetAccessException(
                "Ошибка выполнения SQL-скрипта " + phase + ": " + location, exception);
        } catch (RuntimeException exception) {
            throw new TargetAccessException(
                "Ошибка выполнения SQL-скрипта " + phase + ": " + location, exception);
        }
    }
}

package baileyseyes.oracletopostgres.migration.service;

import baileyseyes.oracletopostgres.migration.common.exception.MigrationConflictException;
import baileyseyes.oracletopostgres.migration.common.exception.SourceAccessException;
import baileyseyes.oracletopostgres.migration.source.config.MigrationSourceProperties;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * Preflight-проверка Oracle-источника перед initial-load.
 * <br>
 * Проверяет отсутствие активных пользовательских сессий
 * в схеме источника и пытается зафиксировать SCN,
 * чтобы понимать точку отсечения данных.
 */
@Slf4j
@Service
public class InitialLoadSourceGuard {

    private static final String ACTIVE_SESSIONS_SQL = """
        SELECT * FROM (
          SELECT sid, serial#, username, program, machine
          FROM v$session
          WHERE type = 'USER'
            AND status = 'ACTIVE'
            AND sid <> SYS_CONTEXT('USERENV', 'SID')
            AND schemaname = UPPER(?)
          ORDER BY sid
        ) WHERE ROWNUM <= 10
        """;

    private static final String ACTIVE_SESSIONS_CURRENT_SCHEMA_SQL = """
        SELECT * FROM (
          SELECT sid, serial#, username, program, machine
          FROM v$session
          WHERE type = 'USER'
            AND status = 'ACTIVE'
            AND sid <> SYS_CONTEXT('USERENV', 'SID')
            AND schemaname = SYS_CONTEXT('USERENV', 'CURRENT_SCHEMA')
          ORDER BY sid
        ) WHERE ROWNUM <= 10
        """;

    private final JdbcTemplate sourceJdbcTemplate;
    private final MigrationSourceProperties sourceProperties;
    private final InitialLoadProperties initialLoadProperties;

    public InitialLoadSourceGuard(@Qualifier("sourceJdbcTemplate") JdbcTemplate sourceJdbcTemplate,
                                  MigrationSourceProperties sourceProperties,
                                  InitialLoadProperties initialLoadProperties) {
        this.sourceJdbcTemplate = sourceJdbcTemplate;
        this.sourceProperties = sourceProperties;
        this.initialLoadProperties = initialLoadProperties;
    }

    /**
     * Выполняет preflight-проверку источника.
     */
    public SourceGuardResult check() {
        Boolean idle = null;

        if (initialLoadProperties.isRequireSourceIdle()) {
            requireIdleSource();
            idle = true;
        } else {
            log.warn("Проверка активных сессий Oracle отключена (require-source-idle=false)");
        }

        Long scn = initialLoadProperties.isCaptureSourceScn() ? captureScn() : null;

        if (scn != null) {
            log.info("SCN Oracle-источника на старте initial-load: {}", scn);
        }

        return new SourceGuardResult(scn, idle);
    }

    private void requireIdleSource() {
        String schema = normalizeSchema(sourceProperties.getSchema());
        String sql = schema == null ? ACTIVE_SESSIONS_CURRENT_SCHEMA_SQL : ACTIVE_SESSIONS_SQL;
        Object[] arguments = schema == null ? new Object[0] : new Object[]{schema};

        try {
            List<String> sessions = sourceJdbcTemplate.query(
                sql,
                (resultSet, rowNumber) -> "sid=" + resultSet.getLong("sid")
                    + ", serial=" + resultSet.getLong("serial#")
                    + ", user=" + resultSet.getString("username")
                    + ", program=" + resultSet.getString("program")
                    + ", machine=" + resultSet.getString("machine"),
                arguments);

            if (!sessions.isEmpty()) {
                throw new MigrationConflictException(
                    "В Oracle есть активные сессии в схеме источника: "
                        + String.join("; ", sessions)
                        + ". Остановите писателей или задайте require-source-idle=false.");
            }
        } catch (DataAccessException exception) {
            throw new SourceAccessException(
                "Не удалось проверить активные сессии Oracle (v$session). "
                    + "Нужны права на v$session или require-source-idle=false.", exception);
        }
    }

    private Long captureScn() {
        try {
            return sourceJdbcTemplate.queryForObject(
                "SELECT DBMS_FLASHBACK.GET_SYSTEM_CHANGE_NUMBER FROM dual", Long.class);
        } catch (DataAccessException flashbackException) {
            log.debug("DBMS_FLASHBACK.GET_SYSTEM_CHANGE_NUMBER недоступен: {}",
                flashbackException.getMessage());
        }

        try {
            return sourceJdbcTemplate.queryForObject("SELECT CURRENT_SCN FROM v$database", Long.class);
        } catch (DataAccessException databaseException) {
            log.warn("Не удалось получить SCN Oracle-источника: {}", databaseException.getMessage());
            return null;
        }
    }

    private String normalizeSchema(String schema) {
        return schema == null || schema.isBlank() ? null : schema.trim();
    }
}

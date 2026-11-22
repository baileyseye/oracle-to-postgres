package baileyseyes.oracletopostgres.schema.target.service;

import baileyseyes.oracletopostgres.schema.common.exception.TargetAccessException;
import baileyseyes.oracletopostgres.schema.dto.SchemaDdlStatement;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
public class PostgresSchemaApplier {

    private final JdbcTemplate schemaTargetJdbcTemplate;

    public PostgresSchemaApplier(
        @Qualifier("schemaTargetJdbcTemplate") JdbcTemplate schemaTargetJdbcTemplate) {
        this.schemaTargetJdbcTemplate = schemaTargetJdbcTemplate;
    }

    @Transactional(transactionManager = "schemaTargetTransactionManager")
    public int apply(List<SchemaDdlStatement> statements) {
        int applied = 0;

        for (SchemaDdlStatement statement : statements) {
            try {
                log.debug("DDL [{} {}]: {}", statement.phase(), statement.objectName(), statement.sql());
                schemaTargetJdbcTemplate.execute(statement.sql());
                applied++;
            } catch (DataAccessException exception) {
                throw new TargetAccessException(
                    "Не удалось выполнить DDL " + statement.phase() + " " + statement.objectName(), exception);
            }
        }

        return applied;
    }
}

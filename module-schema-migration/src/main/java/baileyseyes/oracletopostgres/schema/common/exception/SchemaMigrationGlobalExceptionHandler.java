package baileyseyes.oracletopostgres.schema.common.exception;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@Slf4j
@RestControllerAdvice
public class SchemaMigrationGlobalExceptionHandler {

    @ExceptionHandler(SourceAccessException.class)
    public ResponseEntity<Map<String, Object>> handleSource(SourceAccessException exception) {
        log.error("Ошибка Oracle-источника: {}", exception.getMessage(), exception.getCause());
        return response(HttpStatus.SERVICE_UNAVAILABLE, "Oracle-источник недоступен");
    }

    @ExceptionHandler(TargetAccessException.class)
    public ResponseEntity<Map<String, Object>> handleTarget(TargetAccessException exception) {
        log.error("Ошибка PostgreSQL-приёмника: {}", exception.getMessage(), exception.getCause());
        return response(HttpStatus.SERVICE_UNAVAILABLE, "PostgreSQL-приёмник недоступен");
    }

    @ExceptionHandler(DataAccessException.class)
    public ResponseEntity<Map<String, Object>> handleDataAccess(DataAccessException exception) {
        log.error("Ошибка БД при schema migration: {}", exception.getMessage(), exception);
        return response(HttpStatus.SERVICE_UNAVAILABLE, "База данных недоступна");
    }

    @ExceptionHandler(SchemaMigrationException.class)
    public ResponseEntity<Map<String, Object>> handleMigration(SchemaMigrationException exception) {
        log.error("Ошибка schema migration: {}", exception.getMessage());
        return response(HttpStatus.INTERNAL_SERVER_ERROR, exception.getMessage());
    }

    private ResponseEntity<Map<String, Object>> response(HttpStatus status, String message) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("timestamp", LocalDateTime.now());
        body.put("status", status.value());
        body.put("error", status.getReasonPhrase());
        body.put("message", message);
        return ResponseEntity.status(status).body(body);
    }
}

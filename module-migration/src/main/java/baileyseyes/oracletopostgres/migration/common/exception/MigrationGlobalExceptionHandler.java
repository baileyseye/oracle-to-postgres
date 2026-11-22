package baileyseyes.oracletopostgres.migration.common.exception;

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
public class MigrationGlobalExceptionHandler {

    @ExceptionHandler(TableNotFoundException.class)
    public ResponseEntity<Map<String, Object>> handleTableNotFound(TableNotFoundException exception) {
        log.warn("Запрошена неизвестная таблица источника: {}", exception.getMessage());
        return buildResponse(HttpStatus.NOT_FOUND, exception.getMessage());
    }

    @ExceptionHandler(SourceAccessException.class)
    public ResponseEntity<Map<String, Object>> handleSourceAccess(SourceAccessException exception) {
        log.error("Ошибка доступа к источнику миграции: {}", exception.getMessage(), exception.getCause());
        return buildResponse(HttpStatus.SERVICE_UNAVAILABLE, "Источник миграции недоступен");
    }

    @ExceptionHandler(MigrationConflictException.class)
    public ResponseEntity<Map<String, Object>> handleConflict(MigrationConflictException exception) {
        log.warn("Конфликт данных при миграции: {}", exception.getMessage());
        return buildResponse(HttpStatus.CONFLICT, exception.getMessage());
    }

    @ExceptionHandler(TargetAccessException.class)
    public ResponseEntity<Map<String, Object>> handleTargetAccess(TargetAccessException exception) {
        log.error("Ошибка доступа к приёмнику миграции: {}",
            exception.getMessage(), exception.getCause());
        return buildResponse(HttpStatus.SERVICE_UNAVAILABLE, "Приёмник миграции недоступен");
    }

    @ExceptionHandler(DataAccessException.class)
    public ResponseEntity<Map<String, Object>> handleDataAccess(DataAccessException exception) {
        log.error("Ошибка доступа к базе данных миграции: {}", exception.getMessage(), exception);
        return buildResponse(HttpStatus.SERVICE_UNAVAILABLE, "База данных миграции недоступна");
    }

    @ExceptionHandler(MigrationJobNotFoundException.class)
    public ResponseEntity<Map<String, Object>> handleJobNotFound(MigrationJobNotFoundException exception) {
        log.warn("Job миграции не найден: {}", exception.getMessage());
        return buildResponse(HttpStatus.NOT_FOUND, exception.getMessage());
    }

    @ExceptionHandler(MigrationValidationException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MigrationValidationException exception) {
        log.error("Validation миграции не пройдена: {}", exception.getMessage());
        Map<String, Object> body = buildBody(HttpStatus.UNPROCESSABLE_CONTENT, exception.getMessage());

        if (exception.getReport() != null) {
            body.put("report", exception.getReport());
            body.put("validation", exception.getReport().getValidation());
        }

        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_CONTENT).body(body);
    }

    @ExceptionHandler(MigrationException.class)
    public ResponseEntity<Map<String, Object>> handleMigration(MigrationException exception) {
        log.error("Прикладная ошибка сервиса миграции: {}", exception.getMessage());
        return buildResponse(HttpStatus.INTERNAL_SERVER_ERROR, exception.getMessage());
    }

    private ResponseEntity<Map<String, Object>> buildResponse(HttpStatus status, String message) {
        return ResponseEntity.status(status).body(buildBody(status, message));
    }

    private Map<String, Object> buildBody(HttpStatus status, String message) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("timestamp", LocalDateTime.now());
        body.put("status", status.value());
        body.put("error", status.getReasonPhrase());
        body.put("message", message);

        return body;
    }
}

package baileyseyes.oracletopostgres.migration.common.exception;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
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

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException exception) {
        log.warn("Ошибка валидации запроса: {}", exception.getMessage());
        return buildResponse(HttpStatus.BAD_REQUEST, "Запрос не прошёл валидацию");
    }

    @ExceptionHandler(MigrationException.class)
    public ResponseEntity<Map<String, Object>> handleMigration(MigrationException exception) {
        log.error("Прикладная ошибка сервиса миграции: {}", exception.getMessage());
        return buildResponse(HttpStatus.INTERNAL_SERVER_ERROR, exception.getMessage());
    }

    private ResponseEntity<Map<String, Object>> buildResponse(HttpStatus status, String message) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("timestamp", LocalDateTime.now());
        body.put("status", status.value());
        body.put("error", status.getReasonPhrase());
        body.put("message", message);

        return ResponseEntity.status(status).body(body);
    }
}

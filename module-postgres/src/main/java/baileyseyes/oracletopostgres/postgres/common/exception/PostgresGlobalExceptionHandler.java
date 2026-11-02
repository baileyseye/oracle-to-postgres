package baileyseyes.oracletopostgres.postgres.common.exception;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * Единый формат ошибок REST-API PostgreSQL-модуля.
 */
@Slf4j
@RestControllerAdvice
public class PostgresGlobalExceptionHandler {

  @ExceptionHandler(UserNotFoundException.class)
  public ResponseEntity<Map<String, Object>> handleNotFound(UserNotFoundException exception) {
    log.warn("Пользователь не найден: {}", exception.getMessage());
    return buildResponse(HttpStatus.NOT_FOUND, exception.getMessage());
  }

  @ExceptionHandler(DuplicateUserException.class)
  public ResponseEntity<Map<String, Object>> handleDuplicate(DuplicateUserException exception) {
    log.warn("Нарушена уникальность пользователя: {}", exception.getMessage());
    return buildResponse(HttpStatus.CONFLICT, exception.getMessage());
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException exception) {
    Map<String, String> fieldErrors = new LinkedHashMap<>();
    for (FieldError fieldError : exception.getBindingResult().getFieldErrors()) {
      fieldErrors.put(fieldError.getField(), fieldError.getDefaultMessage());
    }
    log.warn("Ошибка валидации запроса: {}", fieldErrors);
    Map<String, Object> body = baseBody(HttpStatus.BAD_REQUEST, "Запрос не прошёл валидацию");
    body.put("errors", fieldErrors);
    return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
  }

  @ExceptionHandler(PostgresModuleException.class)
  public ResponseEntity<Map<String, Object>> handleModule(PostgresModuleException exception) {
    log.error("Прикладная ошибка PostgreSQL-модуля: {}", exception.getMessage());
    return buildResponse(HttpStatus.INTERNAL_SERVER_ERROR, exception.getMessage());
  }

  private ResponseEntity<Map<String, Object>> buildResponse(HttpStatus status, String message) {
    return ResponseEntity.status(status).body(baseBody(status, message));
  }

  private Map<String, Object> baseBody(HttpStatus status, String message) {
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("timestamp", LocalDateTime.now());
    body.put("status", status.value());
    body.put("error", status.getReasonPhrase());
    body.put("message", message);
    return body;
  }
}

package baileyseyes.oracletopostgres.oracle.user.controller;

import static org.springframework.http.ResponseEntity.noContent;
import static org.springframework.http.ResponseEntity.ok;
import static org.springframework.http.ResponseEntity.status;

import baileyseyes.oracletopostgres.oracle.user.dto.UserRequestDto;
import baileyseyes.oracletopostgres.oracle.user.dto.UserResponseDto;
import baileyseyes.oracletopostgres.oracle.user.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/oracle")
public class UserController {

    private final UserService userService;

    /**
     * POST {@code http://localhost:8081/api/v1/oracle/users}
     * <br><br>
     * Body:
     * <pre>{@code
     * {
     *   "username": "ivan_petrov",
     *   "email": "ivan.petrov@example.com"
     * }
     * }</pre>
     */
    @PostMapping("/users")
    public ResponseEntity<UserResponseDto> createUser(@Valid @RequestBody UserRequestDto request) {
        return status(HttpStatus.CREATED).body(userService.createUser(request));
    }

    /**
     * GET {@code http://localhost:8081/api/v1/oracle/users/{id}}
     * <br>
     * Пример: {@code http://localhost:8081/api/v1/oracle/users/1}
     */
    @GetMapping("/users/{id}")
    public ResponseEntity<UserResponseDto> getUserById(@PathVariable Long id) {
        return ok(userService.getUserById(id));
    }

    /**
     * GET {@code http://localhost:8081/api/v1/oracle/get-users?page=0&size=20}
     * <br>
     * Пример: {@code http://localhost:8081/api/v1/oracle/get-users?page=0&size=20&sort=id,desc}
     */
    @GetMapping("/get-users")
    public ResponseEntity<Page<UserResponseDto>> getUsers(@PageableDefault(size = 20, sort = "id") Pageable pageable) {
        return ok(userService.getUsers(pageable));
    }

    /**
     * PUT {@code http://localhost:8081/api/v1/oracle/users/{id}}
     * <br><br>
     * Body:
     * <pre>{@code
     * {
     *   "username": "ivan_petrov_updated",
     *   "email": "ivan.updated@example.com"
     * }
     * }</pre>
     */
    @PutMapping("/users/{id}")
    public ResponseEntity<UserResponseDto> updateUser(@PathVariable Long id,
                                                      @Valid @RequestBody UserRequestDto request) {
        return ok(userService.updateUser(id, request));
    }

    /**
     * DELETE {@code http://localhost:8081/api/v1/oracle/users/{id}}
     * <br>
     * Пример: {@code http://localhost:8081/api/v1/oracle/users/1}
     */
    @DeleteMapping("/users/{id}")
    public ResponseEntity<Void> deleteUser(@PathVariable Long id) {
        userService.deleteUser(id);
        return noContent().build();
    }
}

package baileyseyes.oracletopostgres.postgres.user.dto;

import static lombok.AccessLevel.PRIVATE;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = PRIVATE)
public class UserRequestDto {

    @NotBlank(message = "Логин обязателен")
    @Size(min = 3, max = 100, message = "Логин должен содержать от 3 до 100 символов")
    String username;

    @NotBlank(message = "Email обязателен")
    @Email(message = "Email должен быть корректным")
    @Size(max = 255, message = "Email не должен превышать 255 символов")
    String email;
}

package baileyseyes.oracletopostgres.postgres.user.dto;

import static lombok.AccessLevel.PRIVATE;

import java.time.LocalDateTime;
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
public class UserResponseDto {

    Long id;

    String username;

    String email;

    LocalDateTime createdAt;

    LocalDateTime updatedAt;
}

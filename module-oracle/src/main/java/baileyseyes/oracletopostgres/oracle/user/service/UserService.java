package baileyseyes.oracletopostgres.oracle.user.service;

import baileyseyes.oracletopostgres.oracle.common.exception.DuplicateUserException;
import baileyseyes.oracletopostgres.oracle.common.exception.UserNotFoundException;
import baileyseyes.oracletopostgres.oracle.user.dto.UserRequestDto;
import baileyseyes.oracletopostgres.oracle.user.dto.UserResponseDto;
import baileyseyes.oracletopostgres.oracle.user.entity.UserEntity;
import baileyseyes.oracletopostgres.oracle.user.mapper.UserMapper;
import baileyseyes.oracletopostgres.oracle.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * CRUD-операции над пользователями в Oracle.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final UserMapper userMapper;

    @Transactional
    public UserResponseDto createUser(UserRequestDto request) {
        validateUnique(request);

        UserEntity entity = userMapper.toEntity(request);
        UserEntity saved = userRepository.save(entity);

        log.info("Создан пользователь id={} в Oracle", saved.getId());
        return userMapper.toResponseDto(saved);
    }

    @Transactional(readOnly = true)
    public UserResponseDto getUserById(Long id) {
        return userMapper.toResponseDto(findEntity(id));
    }

    @Transactional(readOnly = true)
    public Page<UserResponseDto> getUsers(Pageable pageable) {
        return userRepository.findAll(pageable).map(userMapper::toResponseDto);
    }

    @Transactional
    public UserResponseDto updateUser(Long id, UserRequestDto request) {
        UserEntity entity = findEntity(id);

        validateUniqueForUpdate(id, request);

        entity.setUsername(request.getUsername());
        entity.setEmail(request.getEmail());

        UserEntity saved = userRepository.save(entity);

        log.info("Обновлён пользователь id={} в Oracle", saved.getId());
        return userMapper.toResponseDto(saved);
    }

    @Transactional
    public void deleteUser(Long id) {
        UserEntity entity = findEntity(id);
        userRepository.delete(entity);
        log.info("Удалён пользователь id={} в Oracle", id);
    }

    private UserEntity findEntity(Long id) {
        return userRepository.findById(id)
            .orElseThrow(() -> new UserNotFoundException(id));
    }

    private void validateUnique(UserRequestDto request) {
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new DuplicateUserException("username", request.getUsername());
        }

        if (userRepository.existsByEmail(request.getEmail())) {
            throw new DuplicateUserException("email", request.getEmail());
        }
    }

    private void validateUniqueForUpdate(Long id, UserRequestDto request) {
        userRepository.findByUsername(request.getUsername())
            .filter(existing -> !existing.getId().equals(id))
            .ifPresent(existing -> {
                throw new DuplicateUserException("username", request.getUsername());
            });

        userRepository.findByEmail(request.getEmail())
            .filter(existing -> !existing.getId().equals(id))
            .ifPresent(existing -> {
                throw new DuplicateUserException("email", request.getEmail());
            });
    }
}

package baileyseyes.oracletopostgres.oracle.order.service;

import baileyseyes.oracletopostgres.oracle.common.exception.DuplicateOrderException;
import baileyseyes.oracletopostgres.oracle.common.exception.OrderNotFoundException;
import baileyseyes.oracletopostgres.oracle.common.exception.UserNotFoundException;
import baileyseyes.oracletopostgres.oracle.order.dto.OrderRequestDto;
import baileyseyes.oracletopostgres.oracle.order.dto.OrderResponseDto;
import baileyseyes.oracletopostgres.oracle.order.entity.OrderEntity;
import baileyseyes.oracletopostgres.oracle.order.mapper.OrderMapper;
import baileyseyes.oracletopostgres.oracle.order.repository.OrderRepository;
import baileyseyes.oracletopostgres.oracle.user.entity.UserEntity;
import baileyseyes.oracletopostgres.oracle.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * CRUD-операции над заказами в Oracle.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepository;
    private final UserRepository userRepository;
    private final OrderMapper orderMapper;

    @Transactional
    public OrderResponseDto createOrder(OrderRequestDto request) {
        UserEntity user = findUser(request.getUserId());
        validateUnique(request.getOrderNumber(), null);

        OrderEntity entity = orderMapper.toEntity(request);
        entity.setUser(user);

        OrderEntity saved = orderRepository.save(entity);

        log.info("Создан заказ id={} в Oracle", saved.getId());
        return orderMapper.toResponseDto(saved);
    }

    @Transactional(readOnly = true)
    public OrderResponseDto getOrderById(Long id) {
        return orderMapper.toResponseDto(findEntity(id));
    }

    @Transactional(readOnly = true)
    public Page<OrderResponseDto> getOrders(Long userId, Pageable pageable) {
        Page<OrderEntity> page = userId == null
            ? orderRepository.findAll(pageable)
            : orderRepository.findAllByUserId(userId, pageable);

        return page.map(orderMapper::toResponseDto);
    }

    @Transactional
    public OrderResponseDto updateOrder(Long id, OrderRequestDto request) {
        OrderEntity entity = findEntity(id);
        UserEntity user = findUser(request.getUserId());
        validateUnique(request.getOrderNumber(), id);

        entity.setUser(user);
        entity.setOrderNumber(request.getOrderNumber());
        entity.setAmount(request.getAmount());
        entity.setStatus(request.getStatus());

        OrderEntity saved = orderRepository.save(entity);

        log.info("Обновлён заказ id={} в Oracle", saved.getId());
        return orderMapper.toResponseDto(saved);
    }

    @Transactional
    public void deleteOrder(Long id) {
        OrderEntity entity = findEntity(id);
        orderRepository.delete(entity);
        log.info("Удалён заказ id={} в Oracle", id);
    }

    private OrderEntity findEntity(Long id) {
        return orderRepository.findById(id)
            .orElseThrow(() -> new OrderNotFoundException(id));
    }

    private UserEntity findUser(Long userId) {
        return userRepository.findById(userId)
            .orElseThrow(() -> new UserNotFoundException(userId));
    }

    private void validateUnique(String orderNumber, Long excludeId) {
        orderRepository.findByOrderNumber(orderNumber)
            .filter(existing -> excludeId == null || !existing.getId().equals(excludeId))
            .ifPresent(existing -> {
                throw new DuplicateOrderException(orderNumber);
            });
    }
}

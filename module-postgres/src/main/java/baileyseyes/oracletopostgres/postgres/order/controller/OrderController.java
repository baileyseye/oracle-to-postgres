package baileyseyes.oracletopostgres.postgres.order.controller;

import static org.springframework.http.HttpStatus.CREATED;
import static org.springframework.http.ResponseEntity.noContent;
import static org.springframework.http.ResponseEntity.ok;
import static org.springframework.http.ResponseEntity.status;

import baileyseyes.oracletopostgres.postgres.order.dto.OrderRequestDto;
import baileyseyes.oracletopostgres.postgres.order.dto.OrderResponseDto;
import baileyseyes.oracletopostgres.postgres.order.service.OrderService;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/postgres")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;

    /**
     * POST {@code http://localhost:8082/api/v1/postgres/orders}
     * <br><br>
     * Body:
     * <pre>{@code
     * {
     *   "userId": 1,
     *   "orderNumber": "ORD-POSTGRES-2001",
     *   "amount": 1499.90,
     *   "status": "NEW"
     * }
     * }</pre>
     */
    @PostMapping("/orders")
    public ResponseEntity<OrderResponseDto> createOrder(@Valid @RequestBody OrderRequestDto request) {
        return status(CREATED).body(orderService.createOrder(request));
    }

    /**
     * GET {@code http://localhost:8082/api/v1/postgres/orders/{id}}
     * <br>
     * Пример: {@code http://localhost:8082/api/v1/postgres/orders/1}
     */
    @GetMapping("/orders/{id}")
    public ResponseEntity<OrderResponseDto> getOrderById(@PathVariable Long id) {
        return ok(orderService.getOrderById(id));
    }

    /**
     * GET {@code http://localhost:8082/api/v1/postgres/get-orders?page=0&size=20}
     * <br>
     * Пример: {@code http://localhost:8082/api/v1/postgres/get-orders?userId=1&page=0&size=20&sort=id,desc}
     */
    @GetMapping("/get-orders")
    public ResponseEntity<Page<OrderResponseDto>> getOrders(@RequestParam(required = false) Long userId,
                                                            @PageableDefault(size = 20, sort = "id") Pageable pageable) {
        return ok(orderService.getOrders(userId, pageable));
    }

    /**
     * PUT {@code http://localhost:8082/api/v1/postgres/orders/{id}}
     * <br><br>
     * Body:
     * <pre>{@code
     * {
     *   "userId": 1,
     *   "orderNumber": "ORD-POSTGRES-2001",
     *   "amount": 1599.90,
     *   "status": "PAID"
     * }
     * }</pre>
     */
    @PutMapping("/orders/{id}")
    public ResponseEntity<OrderResponseDto> updateOrder(@PathVariable Long id,
                                                        @Valid @RequestBody OrderRequestDto request) {
        return ok(orderService.updateOrder(id, request));
    }

    /**
     * DELETE {@code http://localhost:8082/api/v1/postgres/orders/{id}}
     * <br>
     * Пример: {@code http://localhost:8082/api/v1/postgres/orders/1}
     */
    @DeleteMapping("/orders/{id}")
    public ResponseEntity<Void> deleteOrder(@PathVariable Long id) {
        orderService.deleteOrder(id);
        return noContent().build();
    }
}

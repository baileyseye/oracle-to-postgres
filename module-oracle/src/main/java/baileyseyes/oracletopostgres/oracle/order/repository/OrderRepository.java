package baileyseyes.oracletopostgres.oracle.order.repository;

import baileyseyes.oracletopostgres.oracle.order.entity.OrderEntity;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrderRepository extends JpaRepository<OrderEntity, Long> {

    Optional<OrderEntity> findByOrderNumber(String orderNumber);

    @EntityGraph(attributePaths = "user")
    Page<OrderEntity> findAllByUserId(Long userId, Pageable pageable);

    @Override
    @EntityGraph(attributePaths = "user")
    Optional<OrderEntity> findById(Long id);

    @Override
    @EntityGraph(attributePaths = "user")
    Page<OrderEntity> findAll(Pageable pageable);
}

package baileyseyes.oracletopostgres.oracle.order.entity;

import static lombok.AccessLevel.PRIVATE;

import baileyseyes.oracletopostgres.oracle.user.entity.UserEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "orders")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = PRIVATE)
public class OrderEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long id;

    /**
     * Пользователь, оформивший заказ.
     */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, foreignKey = @ForeignKey(name = "fk_orders_user"))
    UserEntity user;

    /**
     * Публичный номер заказа, уникальный в пределах системы.
     */
    @Column(name = "order_number", nullable = false, unique = true, length = 50)
    String orderNumber;

    /**
     * Сумма заказа в валюте системы.
     */
    @Column(name = "amount", nullable = false, precision = 12, scale = 2)
    BigDecimal amount;

    /**
     * Текущий статус обработки заказа.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    OrderStatus status;

    /**
     * Момент создания заказа в локальном времени приложения.
     */
    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    LocalDateTime createdAt;
}

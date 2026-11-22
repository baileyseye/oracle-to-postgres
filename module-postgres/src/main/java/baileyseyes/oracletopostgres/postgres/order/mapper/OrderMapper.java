package baileyseyes.oracletopostgres.postgres.order.mapper;

import baileyseyes.oracletopostgres.postgres.order.dto.OrderRequestDto;
import baileyseyes.oracletopostgres.postgres.order.dto.OrderResponseDto;
import baileyseyes.oracletopostgres.postgres.order.entity.OrderEntity;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingConstants;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING)
public interface OrderMapper {

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "user", ignore = true)
    @Mapping(target = "orderNumber", source = "orderNumber")
    @Mapping(target = "amount", source = "amount")
    @Mapping(target = "status", source = "status")
    @Mapping(target = "createdAt", ignore = true)
    OrderEntity toEntity(OrderRequestDto request);

    @Mapping(target = "id", source = "id")
    @Mapping(target = "userId", source = "user.id")
    @Mapping(target = "username", source = "user.username")
    @Mapping(target = "orderNumber", source = "orderNumber")
    @Mapping(target = "amount", source = "amount")
    @Mapping(target = "status", source = "status")
    @Mapping(target = "createdAt", source = "createdAt")
    OrderResponseDto toResponseDto(OrderEntity entity);
}

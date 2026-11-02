package baileyseyes.oracletopostgres.migration.common.aspect;

import java.util.Collection;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Pointcut;
import org.springframework.stereotype.Component;

/**
 * Сквозное логирование входов, выходов и длительности вызовов слоёв контроллеров и сервисов.
 * <br>
 * Логика логирования вынесена из бизнес-кода: контроллеры и сервисы о ней не знают.
 */
@Slf4j
@Aspect
@Component
public class LoggingAspect {

    @Pointcut("within(baileyseyes.oracletopostgres.migration.controller..*)")
    public void controllerLayer() {
    }

    @Pointcut("within(baileyseyes.oracletopostgres.migration.source.service..*)")
    public void serviceLayer() {
    }

    @Around("controllerLayer() || serviceLayer()")
    public Object logInvocation(ProceedingJoinPoint joinPoint) throws Throwable {
        String signature = joinPoint.getSignature().toShortString();
        Object[] arguments = joinPoint.getArgs();

        if (log.isDebugEnabled()) {
            log.debug("Вызов {} с аргументами {}", signature, describe(arguments));
        }

        long startedAt = System.nanoTime();

        try {
            Object result = joinPoint.proceed();
            long durationMillis = (System.nanoTime() - startedAt) / 1_000_000;
            log.info("{} выполнен за {} мс", signature, durationMillis);

            if (log.isDebugEnabled()) {
                log.debug("Результат {}: {}", signature, describeResult(result));
            }

            return result;
        } catch (Throwable throwable) {
            long durationMillis = (System.nanoTime() - startedAt) / 1_000_000;
            log.warn("{} завершился ошибкой за {} мс: {}", signature, durationMillis, throwable.getMessage());

            throw throwable;
        }
    }

    private String describe(Object[] arguments) {
        if (arguments == null || arguments.length == 0) {
            return "[]";
        }

        StringBuilder builder = new StringBuilder("[");

        for (int index = 0; index < arguments.length; index++) {
            if (index > 0) {
                builder.append(", ");
            }

            builder.append(arguments[index]);
        }

        return builder.append(']').toString();
    }

    private String describeResult(Object result) {
        if (result instanceof Collection<?> collection) {
            return "коллекция из " + collection.size() + " элементов";
        }

        return String.valueOf(result);
    }
}

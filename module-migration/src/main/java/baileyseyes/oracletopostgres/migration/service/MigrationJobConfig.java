package baileyseyes.oracletopostgres.migration.service;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.task.TaskExecutor;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

/**
 * Executor для асинхронных job миграции.
 * <br>
 * Один поток: параллельная загрузка в рамках одного процесса
 * не поддерживается.
 */
@Configuration
public class MigrationJobConfig {

    @Bean(name = "migrationJobExecutor")
    public TaskExecutor migrationJobExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(1);
        executor.setMaxPoolSize(1);
        executor.setQueueCapacity(1);
        executor.setThreadNamePrefix("migration-job-");
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(60);
        return executor;
    }
}

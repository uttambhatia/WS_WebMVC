package com.ubs.testmanagement.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

@Configuration
@EnableAsync
public class AsyncExecutionConfig {

    @Bean(name = "scheduleTriggerExecutor")
    public Executor scheduleTriggerExecutor(
            @Value("${test.execution.scheduler.trigger.pool-size:4}") int poolSize,
            @Value("${test.execution.scheduler.trigger.queue-capacity:100}") int queueCapacity) {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(poolSize);
        executor.setMaxPoolSize(poolSize);
        executor.setQueueCapacity(queueCapacity);
        executor.setThreadNamePrefix("schedule-trigger-");
        executor.initialize();
        return executor;
    }

    @Bean(name = "scheduleStatusPollExecutor")
    public Executor scheduleStatusPollExecutor(
            @Value("${test.execution.scheduler.status.pool-size:6}") int poolSize,
            @Value("${test.execution.scheduler.status.queue-capacity:200}") int queueCapacity) {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(poolSize);
        executor.setMaxPoolSize(poolSize);
        executor.setQueueCapacity(queueCapacity);
        executor.setThreadNamePrefix("schedule-status-");
        executor.initialize();
        return executor;
    }
}

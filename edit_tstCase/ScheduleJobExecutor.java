package com.ubs.testmanagement.service;

import com.ubs.testmanagement.entity.RunType;
import com.ubs.testmanagement.entity.Schedule;
import com.ubs.testmanagement.entity.TestExecution;
import com.ubs.testmanagement.repository.ExecutionItemRepository;
import com.ubs.testmanagement.repository.ScheduleRepository;
import com.ubs.testmanagement.repository.TestExecutionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Separate bean so that @Transactional is honoured via Spring's AOP proxy.
 * ScheduleJobService calls methods here instead of using self-invocation (this.*).
 */
@Service
public class ScheduleJobExecutor {

    private static final Logger log = LoggerFactory.getLogger(ScheduleJobExecutor.class);

    private final ScheduleRepository scheduleRepository;
    private final ExecutionItemRepository executionItemRepository;
    private final TestExecutionRepository testExecutionRepository;

    public ScheduleJobExecutor(ScheduleRepository scheduleRepository,
                               ExecutionItemRepository executionItemRepository,
                               TestExecutionRepository testExecutionRepository) {
        this.scheduleRepository = scheduleRepository;
        this.executionItemRepository = executionItemRepository;
        this.testExecutionRepository = testExecutionRepository;
    }

    /**
     * Atomically claims the schedule with a conditional DB-level UPDATE before
     * creating the execution record.
     *
     * The UPDATE WHERE clause (active=true AND runAt <= boundary) acts as an
     * optimistic lock: if two threads/processes race, only the one whose UPDATE
     * returns 1 row proceeds; the other gets 0 and returns null (caller skips).
     *
     * @return the new execution's DB id, or null if the schedule was already
     *         claimed by another thread (caller must skip execution).
     */
    @Transactional
    public Long reserveAndCreateExecution(Long scheduleId, LocalDateTime nowUtc,
                                          boolean recurring, LocalDateTime nextRunAt) {
        int updated;
        if (recurring && nextRunAt != null) {
            updated = scheduleRepository.advanceRunAt(scheduleId, nextRunAt, nowUtc, nowUtc);
            if (updated == 1) {
                log.info("ScheduleJobExecutor: schedule id={} advanced to next run at {}", scheduleId, nextRunAt);
            }
        } else {
            updated = scheduleRepository.deactivate(scheduleId, nowUtc);
            if (updated == 1) {
                log.info("ScheduleJobExecutor: schedule id={} deactivated (one-off)", scheduleId);
            }
        }

        if (updated == 0) {
            log.warn("ScheduleJobExecutor: schedule id={} already claimed by another thread – skipping", scheduleId);
            return null;
        }

        // Schedule claimed; create PENDING execution record
        Schedule scheduleRef = scheduleRepository.getReferenceById(scheduleId);
        TestExecution execution = new TestExecution();
        execution.setRunType(RunType.SCHEDULED);
        execution.setStatus("pending");
        execution.setSchedule(scheduleRef);
        execution.setStartedAt(nowUtc);
        testExecutionRepository.save(execution);

        return execution.getExecutionId();
    }

    /** Links execution items to the execution and records the upstream test ID. */
    @Transactional
    public void finaliseExecution(Long executionId, String testId, List<Long> itemIds) {
        testExecutionRepository.findById(executionId).ifPresent(execution -> {
            execution.setTestId(testId);
            execution.setStatus("pending");
            testExecutionRepository.save(execution);
        });

        testExecutionRepository.findById(executionId).ifPresent(execution ->
            executionItemRepository.findAllById(itemIds).forEach(item -> {
                item.setExecution(execution);
                item.setStatus("pending");
                executionItemRepository.save(item);
            })
        );
    }

    /** Marks an execution as errored when the upstream call failed. */
    @Transactional
    public void markExecutionError(Long executionId, String errorMsg, LocalDateTime nowUtc) {
        testExecutionRepository.findById(executionId).ifPresent(execution -> {
            execution.setStatus("error");
            execution.setErrorMessage(errorMsg);
            execution.setFinishedAt(nowUtc);
            testExecutionRepository.save(execution);
        });
    }
}

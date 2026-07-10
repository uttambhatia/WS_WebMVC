package com.ubs.testmanagement.service;

import com.ubs.testmanagement.entity.RunType;
import com.ubs.testmanagement.entity.Schedule;
import com.ubs.testmanagement.entity.ExecutionItem;
import com.ubs.testmanagement.entity.TestExecution;
import com.ubs.testmanagement.repository.ExecutionItemRepository;
import com.ubs.testmanagement.repository.ScheduleRepository;
import com.ubs.testmanagement.repository.TestExecutionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

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
    public void finaliseExecution(Long executionId, String testId, String initialStatus, List<Long> itemIds) {
        testExecutionRepository.findById(executionId).ifPresent(execution -> {
            execution.setTestId(testId);
            execution.setStatus(normalizeStatus(initialStatus));
            testExecutionRepository.save(execution);
        });

        testExecutionRepository.findById(executionId).ifPresent(execution ->
            executionItemRepository.findAllById(itemIds).forEach(item -> {
                item.setExecution(execution);
                item.setStatus(normalizeStatus(initialStatus));
                executionItemRepository.save(item);
            })
        );
    }

    @Transactional
    public void applyPolledStatus(Long executionId, Map<String, Object> payload, LocalDateTime nowUtc) {
        testExecutionRepository.findById(executionId).ifPresent(execution -> {
            String currentStatus = normalizeStatus(execution.getStatus());
            String nextStatus = normalizeStatus(asString(payload.get("status")));

            if (!isProgressionAllowed(currentStatus, nextStatus)) {
                return;
            }

            LocalDateTime startedAt = parseDateTime(payload.get("started_at"));
            LocalDateTime finishedAt = parseDateTime(payload.get("finished_at"));
            if (finishedAt == null && isFinal(nextStatus)) {
                finishedAt = nowUtc;
            }

            String errorMessage = firstNonBlank(
                    asString(payload.get("error_message")),
                    asString(payload.get("stderr")));

            Map<String, Integer> aggregates = extractAggregates(payload);
            int updated = testExecutionRepository.updateStatusIfCurrent(
                    executionId,
                    currentStatus,
                    nextStatus,
                    startedAt,
                    finishedAt,
                    errorMessage,
                    aggregates.get("passed"),
                    aggregates.get("failed"),
                    aggregates.get("error"),
                    aggregates.get("skipped"),
                    aggregates.get("total"));

            if (updated == 1) {
                syncExecutionItems(execution, payload);
            }
        });
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

    @SuppressWarnings("unchecked")
    private void syncExecutionItems(TestExecution execution, Map<String, Object> payload) {
        Object resultsObject = payload.get("results");
        if (!(resultsObject instanceof List<?> results) || results.isEmpty()) {
            return;
        }

        List<ExecutionItem> existingItems = executionItemRepository
                .findByExecutionExecutionIdOrderByScriptOrderAsc(execution.getExecutionId());
        if (existingItems.isEmpty()) {
            return;
        }

        Map<String, ExecutionItem> byScript = new HashMap<>();
        for (ExecutionItem item : existingItems) {
            if (item.getExecScript() != null && !item.getExecScript().isBlank()) {
                byScript.put(item.getExecScript(), item);
            }
        }

        List<ExecutionItem> updates = new ArrayList<>();
        int index = 0;
        for (Object rowObj : results) {
            if (!(rowObj instanceof Map<?, ?> row)) {
                index++;
                continue;
            }

            String scriptName = firstNonBlank(
                    asString(row.get("test_execution_script")),
                    asString(row.get("test_execution_script_path")),
                    asString(row.get("script_path")),
                    asString(row.get("scriptPath")));

            ExecutionItem item = scriptName != null ? byScript.get(scriptName) : null;
            if (item == null && index < existingItems.size()) {
                item = existingItems.get(index);
            }
            if (item == null) {
                index++;
                continue;
            }

            String itemStatus = normalizeStatus(asString(row.get("status")));
            item.setStatus(itemStatus);
            item.setError(firstNonBlank(asString(row.get("error_message")), asString(row.get("error"))));
            Integer duration = asInteger(firstNonNull(row, "duration_seconds", "durationSeconds"));
            if (duration != null) {
                item.setDurationSeconds(duration);
            }
            updates.add(item);
            index++;
        }

        if (!updates.isEmpty()) {
            executionItemRepository.saveAll(updates);
        }
    }

    private Map<String, Integer> extractAggregates(Map<String, Object> payload) {
        int passed = defaultZero(asInteger(payload.get("passed")));
        int failed = defaultZero(asInteger(payload.get("failed")));
        int skipped = defaultZero(asInteger(payload.get("skipped")));
        Integer errorsRaw = asInteger(firstNonNull(payload, "errors", "error"));
        int errors = defaultZero(errorsRaw);

        Integer totalRaw = asInteger(payload.get("total"));
        int total;
        if (totalRaw != null) {
            total = totalRaw;
        } else {
            int fromAgg = passed + failed + skipped + errors;
            if (fromAgg > 0) {
                total = fromAgg;
            } else {
                Object resultsObject = payload.get("results");
                total = resultsObject instanceof List<?> list ? list.size() : 0;
            }
        }

        Map<String, Integer> values = new HashMap<>();
        values.put("passed", passed);
        values.put("failed", failed);
        values.put("skipped", skipped);
        values.put("error", errors);
        values.put("total", total);
        return values;
    }

    private boolean isProgressionAllowed(String currentStatus, String nextStatus) {
        if (nextStatus == null || nextStatus.isBlank()) {
            return false;
        }
        if (Objects.equals(currentStatus, nextStatus)) {
            return true;
        }
        if (isFinal(currentStatus)) {
            return false;
        }
        if ("pending".equals(currentStatus) && "running".equals(nextStatus)) {
            return true;
        }
        return "pending".equals(currentStatus) && isFinal(nextStatus)
                || "running".equals(currentStatus) && isFinal(nextStatus);
    }

    private boolean isFinal(String status) {
        return "completed".equals(status)
                || "failed".equals(status)
                || "error".equals(status);
    }

    private String normalizeStatus(String status) {
        if (status == null || status.isBlank()) {
            return "pending";
        }
        return status.trim().toLowerCase();
    }

    private LocalDateTime parseDateTime(Object value) {
        String raw = asString(value);
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return LocalDateTime.parse(raw);
        } catch (Exception ignored) {
            try {
                return OffsetDateTime.parse(raw)
                        .toInstant()
                        .atZone(ZoneId.of("UTC"))
                        .toLocalDateTime();
            } catch (Exception ignoredAgain) {
                return null;
            }
        }
    }

    private Object firstNonNull(Map<?, ?> source, String... keys) {
        if (source == null || keys == null) {
            return null;
        }
        for (String key : keys) {
            if (source.containsKey(key) && source.get(key) != null) {
                return source.get(key);
            }
        }
        return null;
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    private String asString(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private Integer asInteger(Object value) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        if (value == null) {
            return null;
        }
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (Exception ex) {
            return null;
        }
    }

    private int defaultZero(Integer value) {
        return value == null ? 0 : value;
    }
}

package com.ubs.testmanagement.service;

import com.ubs.testmanagement.entity.ExecutionItem;
import com.ubs.testmanagement.entity.RunType;
import com.ubs.testmanagement.entity.Schedule;
import com.ubs.testmanagement.entity.TestExecution;
import com.ubs.testmanagement.repository.ExecutionItemRepository;
import com.ubs.testmanagement.repository.ScheduleRepository;
import com.ubs.testmanagement.repository.TestExecutionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.DayOfWeek;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executor;

/**
 * Background job that polls active schedules every 60 seconds and triggers
 * test execution when a schedule's run_at time has been reached.
 *
 * Frequency codes handled:
 *   DAILY       – next run in exactly 24 hours (same wall-clock time in timezone)
 *   WEEKLY      – next run in exactly 7 days
 *   WEEKDAYS    – next run on the following Monday-Friday in the schedule timezone
 *   MONTHLY     – next run on the same day of the next calendar month
 *   BI_MONTHLY  – next run on the same day two calendar months later
 *   FORTNIGHTLY – next run in exactly 14 days
 */
@Service
public class ScheduleJobService {

    private static final Logger log = LoggerFactory.getLogger(ScheduleJobService.class);
    private static final List<String> LIVE_STATUSES = List.of("pending", "running");

    private final ScheduleRepository scheduleRepository;
    private final ExecutionItemRepository executionItemRepository;
    private final TestExecutionRepository testExecutionRepository;
    private final RestTemplate restTemplate;
    private final ScheduleJobExecutor scheduleJobExecutor;
    private final Executor scheduleTriggerExecutor;
    private final Executor scheduleStatusPollExecutor;
    private final String upstreamBaseUrl;
    private final boolean mockExecuteEnabled;
    private final int statusPollBatchSize;
    private final Set<Long> inFlightStatusPolls = ConcurrentHashMap.newKeySet();

    public ScheduleJobService(
            ScheduleRepository scheduleRepository,
            ExecutionItemRepository executionItemRepository,
            TestExecutionRepository testExecutionRepository,
            ScheduleJobExecutor scheduleJobExecutor,
            @Qualifier("scheduleTriggerExecutor") Executor scheduleTriggerExecutor,
            @Qualifier("scheduleStatusPollExecutor") Executor scheduleStatusPollExecutor,
            RestTemplate restTemplate,
            @Value("${test.execution.upstream.base-url:http://localhost:8000}") String upstreamBaseUrl,
            @Value("${test.execution.mock.execute-response-enabled:false}") boolean mockExecuteEnabled,
            @Value("${test.execution.scheduler.status.batch-size:100}") int statusPollBatchSize) {
        this.scheduleRepository = scheduleRepository;
        this.executionItemRepository = executionItemRepository;
        this.testExecutionRepository = testExecutionRepository;
        this.scheduleJobExecutor = scheduleJobExecutor;
        this.scheduleTriggerExecutor = scheduleTriggerExecutor;
        this.scheduleStatusPollExecutor = scheduleStatusPollExecutor;
        this.restTemplate = restTemplate;
        this.upstreamBaseUrl = upstreamBaseUrl.endsWith("/")
                ? upstreamBaseUrl.substring(0, upstreamBaseUrl.length() - 1)
                : upstreamBaseUrl;
        this.mockExecuteEnabled = mockExecuteEnabled;
        this.statusPollBatchSize = Math.max(statusPollBatchSize, 1);
    }

    // -------------------------------------------------------------------------
    // Main job – runs every 60 seconds
    // -------------------------------------------------------------------------

    @Scheduled(fixedDelayString = "${test.execution.scheduler.due-scan-delay-ms:60000}")
    public void processDueSchedules() {
        LocalDateTime nowUtc = LocalDateTime.now(ZoneId.of("UTC"));
        List<Schedule> due = scheduleRepository.findDueSchedules(nowUtc);

        if (due.isEmpty()) {
            return;
        }

        log.info("ScheduleJob: {} due schedule(s) found at {}", due.size(), nowUtc);

        for (Schedule schedule : due) {
            scheduleTriggerExecutor.execute(() -> {
                try {
                    processSchedule(schedule, LocalDateTime.now(ZoneId.of("UTC")));
                } catch (Exception ex) {
                    log.error("ScheduleJob: error processing schedule id={}: {}", schedule.getScheduleId(), ex.getMessage(), ex);
                }
            });
        }
    }

    @Scheduled(fixedDelayString = "${test.execution.scheduler.status-poll-delay-ms:10000}")
    public void pollScheduledExecutionStatuses() {
        List<TestExecution> candidates = testExecutionRepository.findPollableScheduledExecutions(
                RunType.SCHEDULED,
                LIVE_STATUSES,
                PageRequest.of(0, statusPollBatchSize));

        if (candidates.isEmpty()) {
            return;
        }

        for (TestExecution execution : candidates) {
            if (execution.getExecutionId() == null || execution.getTestId() == null || execution.getTestId().isBlank()) {
                continue;
            }

            if (!inFlightStatusPolls.add(execution.getExecutionId())) {
                continue;
            }

            scheduleStatusPollExecutor.execute(() -> {
                try {
                    pollSingleExecutionStatus(execution);
                } catch (Exception ex) {
                    log.warn("ScheduleJob: status poll failed for execution id={}, testId={}: {}",
                            execution.getExecutionId(), execution.getTestId(), ex.getMessage());
                } finally {
                    inFlightStatusPolls.remove(execution.getExecutionId());
                }
            });
        }
    }

    // -------------------------------------------------------------------------
    // Per-schedule processing
    // -------------------------------------------------------------------------

    public void processSchedule(Schedule schedule, LocalDateTime nowUtc) {
        Long scheduleId = schedule.getScheduleId();
        log.info("ScheduleJob: triggering schedule id={}", scheduleId);

        // Collect scripts linked to this schedule
        List<ExecutionItem> items = executionItemRepository
                .findBySchedule_ScheduleIdOrderByScriptOrder(scheduleId);
        List<String> scriptPaths = items.stream()
                .map(ExecutionItem::getExecScript)
                .filter(p -> p != null && !p.isBlank())
                .toList();
        List<Long> itemIds = items.stream().map(ExecutionItem::getItemId).toList();

        // Compute next run BEFORE reserving so schedule entity is still fully loaded
        boolean recurring = Boolean.TRUE.equals(schedule.getRecurring());
        LocalDateTime nextRunAt = (recurring && schedule.getFrequency() != null)
                ? computeNextRunAt(schedule, nowUtc) : null;

        // ATOMICALLY claim schedule via DB UPDATE; returns null if another thread already did it
        Long executionId = scheduleJobExecutor.reserveAndCreateExecution(
                scheduleId, nowUtc, recurring, nextRunAt);

        if (executionId == null) {
            return; // already handled by another thread/process
        }

        // Call upstream OUTSIDE any transaction to avoid holding DB locks during HTTP
        try {
            Map<String, Object> executeResponse = callExecuteEndpoint(scriptPaths, executionId);
            String testId = asString(executeResponse.get("test_id"));
            String initialStatus = asString(executeResponse.get("status"));
            if (testId != null) {
                scheduleJobExecutor.finaliseExecution(executionId, testId, initialStatus, itemIds);
                scheduleJobExecutor.applyPolledStatus(executionId, executeResponse, nowUtc);
            }
        } catch (Exception ex) {
            log.warn("ScheduleJob: execute call failed for schedule id={}: {}", scheduleId, ex.getMessage());
            scheduleJobExecutor.markExecutionError(executionId,
                    "Upstream execute failed: " + ex.getMessage(), nowUtc);
        }
    }

    // -------------------------------------------------------------------------
    // Frequency logic
    // -------------------------------------------------------------------------

    /**
     * Computes the next UTC run time from the current fired time,
     * respecting the schedule's timezone and frequency code.
     */
    private LocalDateTime computeNextRunAt(Schedule schedule, LocalDateTime nowUtc) {
        String tzCode = schedule.getTimezone() != null ? schedule.getTimezone().getTimezoneCode() : "UTC";
        ZoneId zoneId;
        try {
            zoneId = ZoneId.of(tzCode);
        } catch (Exception e) {
            zoneId = ZoneId.of("UTC");
        }

        // Convert current UTC now to the schedule's timezone
        ZonedDateTime nowInZone = nowUtc.atZone(ZoneId.of("UTC")).withZoneSameInstant(zoneId);
        ZonedDateTime next;

        String freqCode = schedule.getFrequency().getFrequencyCode().toUpperCase();
        switch (freqCode) {
            case "DAILY" -> next = nowInZone.plusDays(1)
                    .withHour(schedule.getScheduleTime().getHour())
                    .withMinute(schedule.getScheduleTime().getMinute())
                    .withSecond(0).withNano(0);

            case "WEEKLY" -> next = nowInZone.plusWeeks(1)
                    .withHour(schedule.getScheduleTime().getHour())
                    .withMinute(schedule.getScheduleTime().getMinute())
                    .withSecond(0).withNano(0);

            case "WEEKDAYS" -> {
                // Advance one calendar day at a time until we land on Mon-Fri
                ZonedDateTime candidate = nowInZone.plusDays(1)
                        .withHour(schedule.getScheduleTime().getHour())
                        .withMinute(schedule.getScheduleTime().getMinute())
                        .withSecond(0).withNano(0);
                while (candidate.getDayOfWeek() == DayOfWeek.SATURDAY
                        || candidate.getDayOfWeek() == DayOfWeek.SUNDAY) {
                    candidate = candidate.plusDays(1);
                }
                next = candidate;
            }

            case "FORTNIGHTLY" -> next = nowInZone.plusWeeks(2)
                    .withHour(schedule.getScheduleTime().getHour())
                    .withMinute(schedule.getScheduleTime().getMinute())
                    .withSecond(0).withNano(0);

            case "MONTHLY" -> next = nowInZone.plusMonths(1)
                    .withHour(schedule.getScheduleTime().getHour())
                    .withMinute(schedule.getScheduleTime().getMinute())
                    .withSecond(0).withNano(0);

            case "BI_MONTHLY" -> next = nowInZone.plusMonths(2)
                    .withHour(schedule.getScheduleTime().getHour())
                    .withMinute(schedule.getScheduleTime().getMinute())
                    .withSecond(0).withNano(0);

            default -> {
                // Unknown frequency – default to daily
                log.warn("ScheduleJob: unknown frequency code '{}', defaulting to DAILY", freqCode);
                next = nowInZone.plusDays(1)
                        .withHour(schedule.getScheduleTime().getHour())
                        .withMinute(schedule.getScheduleTime().getMinute())
                        .withSecond(0).withNano(0);
            }
        }

        // Convert back to UTC for storage
        return next.withZoneSameInstant(ZoneId.of("UTC")).toLocalDateTime();
    }

    // -------------------------------------------------------------------------
    // Execute endpoint call
    // -------------------------------------------------------------------------

    @SuppressWarnings("unchecked")
    private Map<String, Object> callExecuteEndpoint(List<String> scriptPaths, Long executionId) {
        if (mockExecuteEnabled) {
            Map<String, Object> mock = new LinkedHashMap<>();
            String testId = "scheduled-" + UUID.randomUUID();
            String now = OffsetDateTime.now(ZoneId.of("UTC")).toString();
            mock.put("test_id", testId);
            mock.put("status", "pending");
            mock.put("created_at", now);
            mock.put("started_at", now);
            mock.put("results", Collections.emptyList());
            return mock;
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("script_paths", scriptPaths);
        body.put("script_path", scriptPaths.isEmpty() ? null : scriptPaths.get(0));
        body.put("source", "scheduler");
        body.put("execution_id", executionId);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);

        ResponseEntity<Map> response = restTemplate.exchange(
                upstreamBaseUrl + "/api/v1/tests/execute",
                HttpMethod.POST,
                request,
                Map.class);

        return response.getBody() == null ? new LinkedHashMap<>() : response.getBody();
    }

    @SuppressWarnings("unchecked")
    private void pollSingleExecutionStatus(TestExecution execution) {
        Map<String, Object> statusPayload;
        if (mockExecuteEnabled) {
            statusPayload = buildMockStatusPayload(execution);
        } else {
            statusPayload = callStatusEndpoint(execution.getTestId());
        }

        if (statusPayload == null || statusPayload.isEmpty()) {
            return;
        }

        scheduleJobExecutor.applyPolledStatus(
                execution.getExecutionId(),
                statusPayload,
                LocalDateTime.now(ZoneId.of("UTC")));
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> callStatusEndpoint(String testId) {
        ResponseEntity<Map> response = restTemplate.exchange(
                upstreamBaseUrl + "/api/v1/tests/" + testId,
                HttpMethod.GET,
                new HttpEntity<>(new HttpHeaders()),
                Map.class);

        return response.getBody() == null ? new LinkedHashMap<>() : response.getBody();
    }

    private Map<String, Object> buildMockStatusPayload(TestExecution execution) {
        LocalDateTime nowUtc = LocalDateTime.now(ZoneId.of("UTC"));
        LocalDateTime started = execution.getStartedAt() != null ? execution.getStartedAt() : execution.getCreatedAt();
        long elapsed = started == null ? 0 : Math.max(0, java.time.Duration.between(started, nowUtc).getSeconds());

        String status;
        if (elapsed < 5) {
            status = "pending";
        } else if (elapsed < 30) {
            status = "running";
        } else {
            status = "completed";
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("test_id", execution.getTestId());
        payload.put("status", status);
        payload.put("started_at", started == null ? null : OffsetDateTime.of(started, java.time.ZoneOffset.UTC).toString());

        if (!"completed".equals(status)) {
            payload.put("results", Collections.emptyList());
            return payload;
        }

        List<ExecutionItem> items = executionItemRepository
                .findByExecutionExecutionIdOrderByScriptOrderAsc(execution.getExecutionId());
        List<Map<String, Object>> results = new ArrayList<>();
        int passed = 0;

        for (ExecutionItem item : items) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("test_execution_script", item.getExecScript());
            row.put("status", "completed");
            row.put("duration_seconds", 1);
            row.put("error_message", null);
            results.add(row);
            passed++;
        }

        payload.put("finished_at", OffsetDateTime.of(nowUtc, java.time.ZoneOffset.UTC).toString());
        payload.put("passed", passed);
        payload.put("failed", 0);
        payload.put("skipped", 0);
        payload.put("errors", 0);
        payload.put("total", results.size());
        payload.put("results", results);
        return payload;
    }

    private String asString(Object value) {
        if (value == null) {
            return null;
        }
        String raw = String.valueOf(value).trim();
        return raw.isEmpty() ? null : raw;
    }
}

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
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.time.DayOfWeek;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

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

    private final ScheduleRepository scheduleRepository;
    private final ExecutionItemRepository executionItemRepository;
    private final TestExecutionRepository testExecutionRepository;
    private final RestTemplate restTemplate;
    private final String upstreamBaseUrl;
    private final boolean mockExecuteEnabled;

    public ScheduleJobService(
            ScheduleRepository scheduleRepository,
            ExecutionItemRepository executionItemRepository,
            TestExecutionRepository testExecutionRepository,
            RestTemplate restTemplate,
            @Value("${test.execution.upstream.base-url:http://localhost:8000}") String upstreamBaseUrl,
            @Value("${test.execution.mock.execute-response-enabled:false}") boolean mockExecuteEnabled) {
        this.scheduleRepository = scheduleRepository;
        this.executionItemRepository = executionItemRepository;
        this.testExecutionRepository = testExecutionRepository;
        this.restTemplate = restTemplate;
        this.upstreamBaseUrl = upstreamBaseUrl.endsWith("/")
                ? upstreamBaseUrl.substring(0, upstreamBaseUrl.length() - 1)
                : upstreamBaseUrl;
        this.mockExecuteEnabled = mockExecuteEnabled;
    }

    // -------------------------------------------------------------------------
    // Main job – runs every 60 seconds
    // -------------------------------------------------------------------------

    @Scheduled(fixedDelay = 60_000)
    public void processDueSchedules() {
        LocalDateTime nowUtc = LocalDateTime.now(ZoneId.of("UTC"));
        List<Schedule> due = scheduleRepository.findDueSchedules(nowUtc);

        if (due.isEmpty()) {
            return;
        }

        log.info("ScheduleJob: {} due schedule(s) found at {}", due.size(), nowUtc);

        for (Schedule schedule : due) {
            try {
                processSchedule(schedule, nowUtc);
            } catch (Exception ex) {
                log.error("ScheduleJob: error processing schedule id={}: {}", schedule.getScheduleId(), ex.getMessage(), ex);
            }
        }
    }

    // -------------------------------------------------------------------------
    // Per-schedule processing
    // -------------------------------------------------------------------------

    @Transactional
    public void processSchedule(Schedule schedule, LocalDateTime nowUtc) {
        Long scheduleId = schedule.getScheduleId();
        log.info("ScheduleJob: triggering schedule id={}", scheduleId);

        // --- collect scripts associated with this schedule ---
        List<ExecutionItem> items = executionItemRepository.findBySchedule_ScheduleIdOrderByScriptOrder(scheduleId);
        List<String> scriptPaths = items.stream()
                .map(ExecutionItem::getExecScript)
                .filter(p -> p != null && !p.isBlank())
                .toList();

        // --- create a PENDING TestExecution record first ---
        TestExecution execution = new TestExecution();
        execution.setRunType(RunType.SCHEDULED);
        execution.setStatus("pending");
        execution.setSchedule(schedule);
        execution.setStartedAt(nowUtc);
        testExecutionRepository.save(execution);

        // --- call upstream execute endpoint ---
        String testId = null;
        try {
            testId = callExecuteEndpoint(scriptPaths, execution.getExecutionId());
        } catch (Exception ex) {
            log.warn("ScheduleJob: execute call failed for schedule id={}: {}", scheduleId, ex.getMessage());
            execution.setStatus("error");
            execution.setErrorMessage("Upstream execute failed: " + ex.getMessage());
            execution.setFinishedAt(nowUtc);
            testExecutionRepository.save(execution);
        }

        if (testId != null) {
            execution.setTestId(testId);
            execution.setStatus("pending");
            testExecutionRepository.save(execution);

            // link execution items to this execution
            for (ExecutionItem item : items) {
                item.setExecution(execution);
                item.setStatus("pending");
                executionItemRepository.save(item);
            }
        }

        // --- update schedule: last_run_at and compute next run_at ---
        schedule.setLastRunAt(nowUtc);

        Boolean recurring = Boolean.TRUE.equals(schedule.getRecurring());
        if (recurring && schedule.getFrequency() != null) {
            LocalDateTime nextRun = computeNextRunAt(schedule, nowUtc);
            schedule.setRunAt(nextRun);
            log.info("ScheduleJob: schedule id={} next run at {}", scheduleId, nextRun);
        } else {
            // one-off schedule – deactivate after firing
            schedule.setActive(false);
            schedule.setRunAt(null);
            log.info("ScheduleJob: schedule id={} deactivated (one-off)", scheduleId);
        }

        scheduleRepository.save(schedule);
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
    private String callExecuteEndpoint(List<String> scriptPaths, Long executionId) {
        if (mockExecuteEnabled) {
            // Return a stable mock test ID derived from executionId
            return "scheduled-" + UUID.randomUUID();
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

        if (response.getBody() != null) {
            Object testId = response.getBody().get("test_id");
            return testId != null ? testId.toString() : null;
        }
        return null;
    }
}

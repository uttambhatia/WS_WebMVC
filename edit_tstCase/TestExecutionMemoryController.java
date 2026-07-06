package com.ubs.testmanagement.controller;

import com.ubs.testmanagement.dto.ExecutionItemDto;
import com.ubs.testmanagement.dto.PagedResponseDto;
import com.ubs.testmanagement.dto.TestExecutionDto;
import com.ubs.testmanagement.entity.RunType;
import com.ubs.testmanagement.service.TestExecutionService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * In-memory storage endpoints for test executions.
 *
 * 4) POST /api/v1/saveExecution
 * 5) GET  /api/v1/fetchExecutions
 */
@RestController
@RequestMapping("/api/v1")
public class TestExecutionMemoryController {

    private final TestExecutionService testExecutionService;

    public TestExecutionMemoryController(TestExecutionService testExecutionService) {
        this.testExecutionService = testExecutionService;
    }

    @PostMapping("/saveExecution")
    public ResponseEntity<Map<String, Object>> saveExecution(@RequestBody Map<String, Object> payload) {
        TestExecutionDto request = toTestExecutionDto(payload);
        if (request.getTestId() == null || request.getTestId().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "message", "Failed: 'test_id' is required."
            ));
        }

        TestExecutionDto saved = testExecutionService.upsert(request);

        return ResponseEntity.ok(Map.of(
                "message", "Saved",
                "test_id", saved.getTestId(),
                "execution_id", saved.getExecutionId()
        ));
    }

    @GetMapping("/fetchExecutions")
    public ResponseEntity<Map<String, Object>> fetchExecutions(
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "10") int size,
            @RequestParam(name = "sortBy", defaultValue = "created_at") String sortBy,
            @RequestParam(name = "sortDirection", defaultValue = "desc") String sortDirection) {

        PagedResponseDto<TestExecutionDto> pageResult = testExecutionService.fetchAll(
                page,
                size,
                normalizeSortBy(sortBy),
                sortDirection,
                Map.of());

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("content", pageResult.getContent());
        response.put("totalElements", pageResult.getTotalElements());
        response.put("page", pageResult.getPage());
        response.put("size", pageResult.getSize());
        response.put("totalPages", pageResult.getTotalPages());

        return ResponseEntity.ok(response);
    }

    @GetMapping("/execution/{executionId}")
    public ResponseEntity<Map<String, Object>> getExecutionDetail(@PathVariable("executionId") Long executionId) {
        TestExecutionDto execution = testExecutionService.getById(executionId);
        if (execution == null) {
            return ResponseEntity.notFound().build();
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("execution_id", execution.getExecutionId());
        response.put("test_id", execution.getTestId());
        response.put("status", execution.getStatus());
        response.put("run_type", execution.getRunType());
        response.put("created_at", execution.getCreatedAt());
        response.put("started_at", execution.getStartedAt());
        response.put("finished_at", execution.getFinishedAt());
        response.put("passed", execution.getPassed());
        response.put("failed", execution.getFailed());
        response.put("error", execution.getError());
        response.put("skipped", execution.getSkipped());
        response.put("total", execution.getTotal());
        response.put("error_message", execution.getErrorMessage());
        response.put("execution_items", execution.getExecutionItems());

        // Schedule details if it's a scheduled execution
        if (execution.getScheduleId() != null) {
            response.put("schedule_id", execution.getScheduleId());
        }

        return ResponseEntity.ok(response);
    }

    private String normalizeSortBy(String sortBy) {
        if (sortBy == null || sortBy.isBlank()) {
            return "createdAt";
        }
        return switch (sortBy) {
            case "created_at" -> "createdAt";
            case "started_at" -> "startedAt";
            case "finished_at" -> "finishedAt";
            case "test_id" -> "testId";
            case "run_type" -> "runType";
            default -> sortBy;
        };
    }

    private TestExecutionDto toTestExecutionDto(Map<String, Object> payload) {
        TestExecutionDto dto = new TestExecutionDto();
        dto.setTestId(asString(payload.get("test_id")));
        dto.setRunType(parseRunType(payload.get("run_type")));
        dto.setStatus(defaultString(asString(payload.get("status")), "PENDING"));
        dto.setErrorMessage(asString(payload.get("error_message")));
        dto.setStartedAt(parseDateTime(payload.get("started_at")));
        dto.setFinishedAt(parseDateTime(payload.get("finished_at")));
        dto.setPassed(asInteger(payload.get("passed")));
        dto.setFailed(asInteger(payload.get("failed")));
        dto.setError(asInteger(payload.get("error")));
        dto.setSkipped(asInteger(payload.get("skipped")));
        dto.setTotal(asInteger(payload.get("total")));

        Object scheduleId = payload.get("schedule_id");
        if (scheduleId != null) {
            dto.setScheduleId(asLong(scheduleId));
        }

        dto.setExecutionItems(extractExecutionItems(payload));
        return dto;
    }

    private String asString(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private String defaultString(String value, String defaultValue) {
        return value == null || value.isBlank() ? defaultValue : value;
    }

    private Integer asInteger(Object value) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        if (value == null) {
            return null;
        }
        try {
            return Integer.valueOf(String.valueOf(value));
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private Long asLong(Object value) {
        if (value instanceof Number number) {
            return number.longValue();
        }
        try {
            return Long.valueOf(String.valueOf(value));
        } catch (Exception ex) {
            return null;
        }
    }

    private RunType parseRunType(Object value) {
        String raw = asString(value);
        if (raw == null || raw.isBlank()) {
            return RunType.ADHOC;
        }
        try {
            return RunType.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            return RunType.ADHOC;
        }
    }

    private LocalDateTime parseDateTime(Object value) {
        String raw = asString(value);
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return LocalDateTime.parse(raw.trim());
        } catch (DateTimeParseException ex) {
            return null;
        }
    }

    @SuppressWarnings("unchecked")
    private List<ExecutionItemDto> extractExecutionItems(Map<String, Object> payload) {
        Object directItems = payload.get("execution_items");
        Object results = payload.get("results");
        Object source = directItems != null ? directItems : results;
        if (!(source instanceof List<?> items)) {
            return List.of();
        }

        List<ExecutionItemDto> executionItems = new ArrayList<>();
        for (Object entry : items) {
            if (!(entry instanceof Map<?, ?> itemMap)) {
                continue;
            }

            Map<String, Object> item = (Map<String, Object>) itemMap;
            ExecutionItemDto dto = new ExecutionItemDto();
            dto.setExecCaseId(asString(item.get("test_case_id")));
            dto.setExecCaseName(asString(item.get("test_case_name")));
            dto.setExecScript(asString(item.get("test_execution_script")));
            dto.setScriptOrder(asInteger(item.get("script_order")));
            dto.setStatus(asString(item.get("status")));
            dto.setError(asString(item.get("error_message")));
            dto.setDurationSeconds(asInteger(item.get("duration_seconds")));
            dto.setScheduleId(asLong(item.get("schedule_id")));
            executionItems.add(dto);
        }

        return executionItems;
    }
}

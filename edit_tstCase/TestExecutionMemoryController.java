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
import java.util.HashMap;
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
            @RequestParam(name = "sortDirection", defaultValue = "desc") String sortDirection,
            @RequestParam(name = "scheduleId", required = false) String scheduleId,
            @RequestParam(name = "testId", required = false) String testId,
            @RequestParam(name = "status", required = false) String status,
            @RequestParam(name = "runType", required = false) String runType) {

        Map<String, String> filters = new HashMap<>();
        putIfPresent(filters, "scheduleId", scheduleId);
        putIfPresent(filters, "testId", testId);
        putIfPresent(filters, "status", status);
        putIfPresent(filters, "runType", runType);

        PagedResponseDto<TestExecutionDto> pageResult = testExecutionService.fetchAll(
                page,
                size,
                normalizeSortBy(sortBy),
                sortDirection,
            filters);

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
        dto.setSource(asString(payload.get("source")));
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

    private void putIfPresent(Map<String, String> filters, String key, String value) {
        if (value == null) {
            return;
        }
        String trimmed = value.trim();
        if (!trimmed.isEmpty()) {
            filters.put(key, trimmed);
        }
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
        if (directItems == null) {
            directItems = payload.get("executionItems");
        }
        Object results = payload.get("results");
        Object source = directItems != null ? directItems : results;
        if (source instanceof List<?> items) {
            List<ExecutionItemDto> executionItems = new ArrayList<>();
            int index = 0;
            for (Object entry : items) {
                if (!(entry instanceof Map<?, ?> itemMap)) {
                    index++;
                    continue;
                }

                Map<String, Object> item = (Map<String, Object>) itemMap;
                ExecutionItemDto dto = new ExecutionItemDto();
                dto.setItemId(asLong(firstNonNull(item, "itemId", "item_id")));
                dto.setExecCaseId(asString(firstNonNull(item, "test_case_id", "testCaseId", "execCaseId")));
                dto.setExecCaseName(asString(firstNonNull(item, "test_case_name", "testCaseName", "execCaseName")));
                dto.setExecScript(asString(firstNonNull(item,
                        "test_execution_script",
                        "execScript",
                        "scriptName",
                        "script_path",
                        "scriptPath")));
                dto.setScriptOrder(asInteger(firstNonNull(item, "script_order", "scriptOrder", index + 1)));
                dto.setStatus(asString(firstNonNull(item, "status")));
                dto.setError(asString(firstNonNull(item, "error_message", "errorMessage", "error")));
                dto.setDurationSeconds(asInteger(firstNonNull(item, "duration_seconds", "durationSeconds", "runDuration")));
                dto.setScheduleId(asLong(firstNonNull(item, "schedule_id", "scheduleId")));

                if (dto.getExecScript() != null && !dto.getExecScript().isBlank()) {
                    executionItems.add(dto);
                }
                index++;
            }

            if (!executionItems.isEmpty()) {
                return executionItems;
            }
        }

        // Fallback for UI payloads that only send selected scripts.
        List<ExecutionItemDto> fromScripts = fromScriptPaths(payload);
        if (!fromScripts.isEmpty()) {
            return fromScripts;
        }

        String singleScript = asString(firstNonNull(payload, "script_path", "scriptPath"));
        if (singleScript == null || singleScript.isBlank()) {
            return List.of();
        }

        ExecutionItemDto dto = new ExecutionItemDto();
        dto.setExecScript(singleScript);
        dto.setScriptOrder(1);
        dto.setStatus(defaultString(asString(payload.get("status")), "PENDING"));
        dto.setError(asString(firstNonNull(payload, "error_message", "errorMessage")));
        dto.setDurationSeconds(asInteger(firstNonNull(payload, "duration_seconds", "durationSeconds")));
        return List.of(dto);
    }

    private List<ExecutionItemDto> fromScriptPaths(Map<String, Object> payload) {
        Object scriptPaths = firstNonNull(payload, "script_paths", "scriptPaths");
        if (!(scriptPaths instanceof List<?> scripts) || scripts.isEmpty()) {
            return List.of();
        }

        List<ExecutionItemDto> executionItems = new ArrayList<>();
        int index = 0;
        for (Object scriptEntry : scripts) {
            String script = asString(scriptEntry);
            if (script == null || script.isBlank()) {
                index++;
                continue;
            }

            ExecutionItemDto dto = new ExecutionItemDto();
            dto.setExecScript(script);
            dto.setScriptOrder(index + 1);
            dto.setStatus(defaultString(asString(payload.get("status")), "PENDING"));
            dto.setError(asString(firstNonNull(payload, "error_message", "errorMessage")));
            dto.setDurationSeconds(asInteger(firstNonNull(payload, "duration_seconds", "durationSeconds")));
            dto.setScheduleId(asLong(firstNonNull(payload, "schedule_id", "scheduleId")));
            executionItems.add(dto);
            index++;
        }

        return executionItems;
    }

    private Object firstNonNull(Map<String, Object> source, Object... keys) {
        if (source == null || keys == null) {
            return null;
        }
        for (Object key : keys) {
            if (key instanceof String name && source.containsKey(name)) {
                Object value = source.get(name);
                if (value != null) {
                    return value;
                }
            } else if (!(key instanceof String)) {
                return key;
            }
        }
        return null;
    }
}

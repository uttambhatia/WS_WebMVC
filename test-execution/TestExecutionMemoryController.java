package com.ubs.testmanagement.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * In-memory storage endpoints for test executions.
 *
 * 4) POST /api/v1/saveExecution
 * 5) GET  /api/v1/fetchExecutions
 */
@RestController
@RequestMapping("/api/v1")
public class TestExecutionMemoryController {

    private static final CopyOnWriteArrayList<Map<String, Object>> EXECUTIONS = new CopyOnWriteArrayList<>();

    @PostMapping("/saveExecution")
    public ResponseEntity<Map<String, Object>> saveExecution(@RequestBody Map<String, Object> payload) {
        String testId = asString(payload.get("test_id"));
        if (testId == null || testId.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "message", "Failed: 'test_id' is required."
            ));
        }

        synchronized (EXECUTIONS) {
            int existingIndex = -1;
            for (int i = 0; i < EXECUTIONS.size(); i++) {
                Map<String, Object> item = EXECUTIONS.get(i);
                if (testId.equals(asString(item.get("test_id")))) {
                    existingIndex = i;
                    break;
                }
            }

            Map<String, Object> normalized = new LinkedHashMap<>(payload);
            if (normalized.get("created_at") == null) {
                normalized.put("created_at", java.time.Instant.now().toString());
            }

            if (existingIndex >= 0) {
                EXECUTIONS.set(existingIndex, normalized);
            } else {
                EXECUTIONS.add(normalized);
            }
        }

        return ResponseEntity.ok(Map.of(
                "message", "Saved",
                "test_id", testId
        ));
    }

    @GetMapping("/fetchExecutions")
    public ResponseEntity<Map<String, Object>> fetchExecutions(
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "10") int size,
            @RequestParam(name = "sortBy", defaultValue = "created_at") String sortBy,
            @RequestParam(name = "sortDirection", defaultValue = "desc") String sortDirection) {

        int safePage = Math.max(page, 0);
        int safeSize = Math.max(size, 1);
        boolean descending = "desc".equalsIgnoreCase(sortDirection);

        List<Map<String, Object>> snapshot = new ArrayList<>(EXECUTIONS);
        snapshot.sort(buildComparator(sortBy, descending));

        int total = snapshot.size();
        int fromIndex = Math.min(safePage * safeSize, total);
        int toIndex = Math.min(fromIndex + safeSize, total);

        List<Map<String, Object>> content = snapshot.subList(fromIndex, toIndex);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("content", content);
        response.put("totalElements", total);
        response.put("page", safePage);
        response.put("size", safeSize);

        return ResponseEntity.ok(response);
    }

    private Comparator<Map<String, Object>> buildComparator(String sortBy, boolean descending) {
        Comparator<Map<String, Object>> comparator = Comparator.comparing(
                item -> normalizeComparable(item.get(sortBy)),
                Comparator.nullsLast(String::compareTo)
        );

        return descending ? comparator.reversed() : comparator;
    }

    private String normalizeComparable(Object value) {
        if (value == null) {
            return "";
        }
        return String.valueOf(value);
    }

    private String asString(Object value) {
        return value == null ? null : String.valueOf(value);
    }
}

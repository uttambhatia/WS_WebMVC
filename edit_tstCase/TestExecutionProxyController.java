package com.ubs.testmanagement.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ubs.testmanagement.dto.ScheduleDto;
import com.ubs.testmanagement.service.ScheduleService;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Proxies Test Execution APIs from UI to the upstream service (default: http://localhost:8000).
 *
 * Endpoints covered as requested:
 * 1) POST /api/v1/tests/execute   -> POST {upstream}/api/v1/tests/execute
 * 2) GET  /api/v1/tests/{testId}  -> GET  {upstream}/api/v1/tests/{testId}
 * 3) GET  /api/v1/tests/scripts   -> GET  {upstream}/api/v1/tests/scripts
 */
@RestController
@RequestMapping("/api/v1/tests")
public class TestExecutionProxyController {

    private final RestTemplate restTemplate;
    private final String upstreamBaseUrl;
    private final boolean mockExecuteResponseEnabled;
    private final boolean mockStatusResponseEnabled;
    private final long mockStatusDelayMs;
    private final List<String> mockStatusSequence;
    private final ScheduleService scheduleService;

    /** testId -> createdAt epoch-millis, used for time-based status progression */
    private final ConcurrentHashMap<String, Long> mockExecutionRegistry = new ConcurrentHashMap<>();


    public TestExecutionProxyController(
            RestTemplate restTemplate,
            ScheduleService scheduleService,
            @Value("${test.execution.upstream.base-url:http://localhost:8000}") String upstreamBaseUrl,
            @Value("${test.execution.mock.execute-response-enabled:false}") boolean mockExecuteResponseEnabled,
            @Value("${test.execution.mock.status-response-enabled:false}") boolean mockStatusResponseEnabled,
            @Value("${test.execution.mock.status-delay-ms:1500}") long mockStatusDelayMs,
            @Value("${test.execution.mock.status-sequence:pending,running,completed}") String mockStatusSequence) {
        this.restTemplate = restTemplate;
        this.scheduleService = scheduleService;
        this.upstreamBaseUrl = sanitizeBaseUrl(upstreamBaseUrl);
        this.mockExecuteResponseEnabled = mockExecuteResponseEnabled;
        this.mockStatusResponseEnabled = mockStatusResponseEnabled;
        this.mockStatusDelayMs = mockStatusDelayMs;
        this.mockStatusSequence = List.of(mockStatusSequence.split(","));
    }

    @PostMapping("/execute")
    public ResponseEntity<?> executeTests(@RequestBody Map<String, Object> payload) {
        if (mockExecuteResponseEnabled) {
            String testId = UUID.randomUUID().toString();
            long now = System.currentTimeMillis();
            mockExecutionRegistry.put(testId, now);

            Map<String, Object> mock = new LinkedHashMap<>();
            mock.put("test_id", testId);
            mock.put("status", "pending");
            mock.put("created_at", Instant.ofEpochMilli(now).toString());
            mock.put("started_at", Instant.ofEpochMilli(now).toString());
            mock.put("script_paths", payload.getOrDefault("script_paths", new ArrayList<>()));
            return ResponseEntity.ok(mock);
        }

        String url = upstreamBaseUrl + "/api/v1/tests/execute";        
        return forwardRequest(url, HttpMethod.POST, payload);
    }

    @GetMapping("/{testId}")
    public ResponseEntity<?> getExecutionStatus(@PathVariable("testId") String testId) {
        if (mockStatusResponseEnabled) {
            // Register unknown testIds on first poll so externally-known IDs also work
            long createdAt = mockExecutionRegistry.computeIfAbsent(testId, k -> System.currentTimeMillis());
            long elapsedSeconds = (System.currentTimeMillis() - createdAt) / 1000;

            String status;
            String finishedAt = null;
            String report = "";
            if (elapsedSeconds < 5) {
                status = "pending";
            } else if (elapsedSeconds < 30) {
                status = "running";
            } else {
                status = "completed";
                finishedAt = Instant.ofEpochMilli(createdAt + 30_000).toString();
                report = "{failed:0, passed:10, skipped:0, errors:0}";
            }

            Map<String, Object> mock = new LinkedHashMap<>();
            mock.put("test_id", testId);
            mock.put("status", status);
            mock.put("created_at", Instant.ofEpochMilli(createdAt).toString());
            mock.put("started_at", Instant.ofEpochMilli(createdAt).toString());
            mock.put("finished_at", finishedAt);
            mock.put("duration_seconds", elapsedSeconds >= 30 ? 30 : null);
            mock.put("stdout", "completed".equals(status) ? "All tests passed." : null);
            mock.put("stderr", null);
            mock.put("return_code", "completed".equals(status) ? 0 : null);
            mock.put("report", report);
            if ("completed".equals(status)) {
                List<Map<String, Object>> results = new ArrayList<>();

                Map<String, Object> row1 = new LinkedHashMap<>();
                row1.put("test_case_id", "TC001");
                row1.put("test_execution_script", "ui/pml/contract_validation_long_name_script.py");
                row1.put("status", "failed");
                row1.put("duration_seconds", 4.000030);
                row1.put("error_message", "failed for bad request");
                results.add(row1);

                Map<String, Object> row2 = new LinkedHashMap<>();
                row2.put("test_case_id", "TC002");
                row2.put("test_execution_script", "ui/pml/smoke_login.py");
                row2.put("status", "completed");
                row2.put("duration_seconds", 6.231100);
                row2.put("error_message", null);
                results.add(row2);

                mock.put("results", results);
            } else {
                mock.put("results", new ArrayList<>());
            }
            return ResponseEntity.ok(mock);
        }

        String url = upstreamBaseUrl + "/api/v1/tests/" + testId;
        return forwardRequest(url, HttpMethod.GET, null);
    }

    @SuppressWarnings("unchecked")
    @GetMapping("/scripts")
    public ResponseEntity<Map<String, Object>> getScriptsHierarchy() {
        String url = upstreamBaseUrl + "/api/v1/tests/scripts";  
        try {
            ClassPathResource resource = new ClassPathResource("tree_hierachy_with_select_checkbox.json");
            ObjectMapper mapper = new ObjectMapper();
            Map<String, Object> response = mapper.readValue(resource.getInputStream(), Map.class);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }     
        //return forwardRequest(url, HttpMethod.GET, null);
    //}

    @PostMapping("/schedule")
    public ResponseEntity<Map<String, Object>> saveSchedule(@RequestBody Map<String, Object> payload) {
        try {
            ScheduleDto saved = scheduleService.save(payload);
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("message", "Schedule saved");
            response.put("schedule_id", saved.getScheduleId());
            response.put("saved_at", Instant.now().toString());
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException ex) {
            Map<String, Object> error = new LinkedHashMap<>();
            error.put("error", ex.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    private ResponseEntity<String> forwardRequest(String url, HttpMethod method, Object body) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        HttpEntity<?> entity = body == null
                ? new HttpEntity<>(headers)
                : new HttpEntity<>(body, headers);

        try {
            ResponseEntity<String> upstreamResponse = restTemplate.exchange(url, method, entity, String.class);
            return ResponseEntity
                    .status(upstreamResponse.getStatusCode())
                    .headers(filterHeaders(upstreamResponse.getHeaders()))
                    .body(upstreamResponse.getBody());
        } catch (HttpStatusCodeException exception) {
            return ResponseEntity
                    .status(exception.getStatusCode())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(exception.getResponseBodyAsString());
        } catch (RestClientException exception) {
            Map<String, String> error = new LinkedHashMap<>();
            error.put("error", "upstream_unavailable");
            error.put("message", "Upstream service is unreachable: " + exception.getMessage());
            try {
                return ResponseEntity
                        .status(503)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(error));
            } catch (Exception jsonEx) {
                return ResponseEntity.status(503).body("{\"error\":\"upstream_unavailable\"}");
            }
        }
    }

    private HttpHeaders filterHeaders(HttpHeaders source) {
        HttpHeaders filtered = new HttpHeaders();
        if (source.getContentType() != null) {
            filtered.setContentType(source.getContentType());
        }
        return filtered;
    }

    private String sanitizeBaseUrl(String baseUrl) {
        if (baseUrl == null || baseUrl.isBlank()) {
            return "http://localhost:8000";
        }
        return baseUrl.endsWith("/")
                ? baseUrl.substring(0, baseUrl.length() - 1)
                : baseUrl;
    }


}

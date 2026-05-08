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
import org.springframework.web.client.RestTemplate;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

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


    public TestExecutionProxyController(
            RestTemplate restTemplate,
            @Value("${test.execution.upstream.base-url:http://localhost:8000}") String upstreamBaseUrl,
            @Value("${test.execution.mock.execute-response-enabled:false}") boolean mockExecuteResponseEnabled,
            @Value("${test.execution.mock.status-response-enabled:false}") boolean mockStatusResponseEnabled,
            @Value("${test.execution.mock.status-delay-ms:1500}") long mockStatusDelayMs,
            @Value("${test.execution.mock.status-sequence:pending,running,completed}") String mockStatusSequence) {
        this.restTemplate = restTemplate;
        this.upstreamBaseUrl = sanitizeBaseUrl(upstreamBaseUrl);
       
    }

    @PostMapping("/execute")
    public ResponseEntity<?> executeTests(@RequestBody Map<String, Object> payload) {       

        String url = upstreamBaseUrl + "/api/v1/tests/execute";        
        return forwardRequest(url, HttpMethod.POST, payload);
    }

    @GetMapping("/{testId}")
    public ResponseEntity<?> getExecutionStatus(@PathVariable String testId) {        

        String url = upstreamBaseUrl + "/api/v1/tests/" + testId;
        return forwardRequest(url, HttpMethod.GET, null);
    }

    @SuppressWarnings("unchecked")
    @GetMapping("/scripts")
    public ResponseEntity<String> getScriptsHierarchy() {
        String url = upstreamBaseUrl + "/api/v1/tests/scripts";       
        return forwardRequest(url, HttpMethod.GET, null);
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

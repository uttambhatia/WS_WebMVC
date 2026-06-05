package com.ubs.testmanagement.controller;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.core.io.ClassPathResource;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.*;

/**
 * Handles test management task-level operations.
 *
 * Endpoint 3  : POST /app/EO7/api/testmanagement-task/{taskId}/upload         – upload document
 * Endpoint 3.1: POST /app/EO7/api/testmanagement-task/{taskId}/gitlabIssue   – gitlab upload
 * Endpoint 4  : POST /app/EO7/api/testmanagement-task/{taskId}/complete       – complete task
 * Endpoint 5  : GET  /app/EO7/api/testmanagement-task/{taskId}/variables      – fetch variables
 * Endpoint 6  : GET  /app/EO7/api/testmanagement-task/{taskId}/{action}       – approve / reject
 * Endpoint 7  : GET  /app/EO7/api/testmanagement-task/{taskId}/testcases      – fetch test cases
 * Endpoint 8  : GET  /app/EO7/api/testmanagement-task/{taskId}/export         – export test cases
 * Endpoint H1 : GET  /app/EO7/api/testmanagement-task/scripts/hierarchy        – fetch file hierarchy
 */
@RestController
@RequestMapping("/app/EO7/api/testmanagement-task")
public class TestManagementTaskController {

    private final RestTemplate restTemplate;
    private final String squashApiBaseUrl;
    private final String squashTestCasesUrl;
    private final String squashApiToken;

    public TestManagementTaskController(
            RestTemplate restTemplate,
            @Value("${squash.api.base-url:https://squash-wmpc.ubs.net/squash/api/rest/latest}") String squashApiBaseUrl,
            @Value("${squash.api.test-cases-url:https://squash-wmpc.ubs.net/squash/api/rest/test-cases}") String squashTestCasesUrl,
            @Value("${squash.api.token:}") String squashApiToken) {
        this.restTemplate = restTemplate;
        this.squashApiBaseUrl = stripTrailingSlash(squashApiBaseUrl);
        this.squashTestCasesUrl = stripTrailingSlash(squashTestCasesUrl);
        this.squashApiToken = squashApiToken;
    }

    // -----------------------------------------------------------------------
    // Endpoint 3 – Upload requirement document
    // POST /app/EO7/api/testmanagement-task/{taskId}/upload
    // Body: multipart/form-data  "file"
    // -----------------------------------------------------------------------
    @PostMapping("/{taskId}/upload")
    public ResponseEntity<String> uploadDocument(
            @PathVariable String taskId,
            @RequestParam("file") MultipartFile file) {

        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().body("Failed: No file received.");
        }
        return ResponseEntity.ok("Success");
    }

    // -----------------------------------------------------------------------
    // Endpoint 3.1 – Gitlab upload
    // POST /app/EO7/api/testmanagement-task/{taskId}/gitlabIssue
    //      ?gitlabIssue={url}&gitlabToken={token}
    // -----------------------------------------------------------------------
    @PostMapping("/{taskId}/gitlabIssue")
    public ResponseEntity<String> gitlabUpload(
            @PathVariable String taskId,
            @RequestParam("gitlabIssue") String gitlabIssue,
            @RequestParam("gitlabToken") String gitlabToken) {

        if (gitlabIssue == null || gitlabIssue.isBlank() || gitlabToken == null || gitlabToken.isBlank()) {
            return ResponseEntity.badRequest().body("Failed: Missing gitlab url or token.");
        }
        return ResponseEntity.ok("Success");
    }

    // -----------------------------------------------------------------------
    // Endpoint 4 – Post Upload – Complete task
    // POST /app/EO7/api/testmanagement-task/{taskId}/complete
    // -----------------------------------------------------------------------
    @PostMapping("/{taskId}/complete")
    public ResponseEntity<String> completeTask(@PathVariable String taskId) {
        return ResponseEntity.ok("Success");
    }

    // -----------------------------------------------------------------------
    // Endpoint 5 – Validation – Fetch variables on task
    // GET /app/EO7/api/testmanagement-task/{taskId}/variables
    // -----------------------------------------------------------------------
    @GetMapping("/{taskId}/variables")
    @SuppressWarnings("unchecked")
    public ResponseEntity<Map<String, Object>> getVariables(@PathVariable String taskId) {
        try {
            ClassPathResource resource = new ClassPathResource("validation.json");
            ObjectMapper mapper = new ObjectMapper();
            Map<String, Object> response = mapper.readValue(resource.getInputStream(), Map.class);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    // -----------------------------------------------------------------------
    // Endpoint 6 – Approval / Rejection
    // GET /app/EO7/api/testmanagement-task/{taskId}/{action}
    //     where {action} = "approve" | "reject"
    // -----------------------------------------------------------------------
    @GetMapping("/{taskId}/{action}")
    public ResponseEntity<String> approveOrReject(
            @PathVariable String taskId,
            @PathVariable String action) {

        if ("approve".equalsIgnoreCase(action)) {
            return ResponseEntity.ok("Success");
        } else if ("reject".equalsIgnoreCase(action)) {
            return ResponseEntity.ok("Success");
        }
        return ResponseEntity.badRequest().body("Failed: Unknown action '" + action + "'. Use 'approve' or 'reject'.");
    }

    // -----------------------------------------------------------------------
    // Endpoint 7 – Fetch Test Cases
    // GET /app/EO7/api/testmanagement-task/{taskId}/testcases
    // -----------------------------------------------------------------------
    @GetMapping("/{taskId}/testcases")
    @SuppressWarnings("unchecked")
    public ResponseEntity<Map<String, Object>> getTestCases(@PathVariable String taskId) {
        try {
            ClassPathResource resource = new ClassPathResource("testgeneration.json");
            ObjectMapper mapper = new ObjectMapper();
            Map<String, Object> response = mapper.readValue(resource.getInputStream(), Map.class);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    // -----------------------------------------------------------------------
    // Endpoint 8 – Export Test Cases (download)
    // GET /app/EO7/api/testmanagement-task/{taskId}/export
    // -----------------------------------------------------------------------
    @GetMapping("/{taskId}/export")
    public ResponseEntity<byte[]> exportTestCases(@PathVariable String taskId) {

        // Build a minimal CSV representing the exported test cases
        String csvContent =
                "Test Case Id,Requirement Id,Test Description,Pre-conditions,Test Step Action\r\n" +
                "TC-001,REQ-001,Verify successful login with valid credentials," +
                        "User account must exist in the system," +
                        "\"1. Navigate to login page. 2. Enter valid username and password. 3. Click Login. 4. Verify dashboard is displayed.\"\r\n" +
                "TC-002,REQ-002,Verify requirement document upload success," +
                        "User is logged in and has a valid PDF document," +
                        "\"1. Navigate to Upload screen. 2. Select a PDF file. 3. Click Upload. 4. Verify success notification.\"\r\n";

        byte[] csvBytes = csvContent.getBytes();

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"testcases-" + taskId + ".csv\"")
                .contentType(MediaType.parseMediaType("text/csv"))
                .contentLength(csvBytes.length)
                .body(csvBytes);
    }

    // -----------------------------------------------------------------------
    // Endpoint H1 – Fetch script file hierarchy JSON
    // GET /app/EO7/api/testmanagement-task/scripts/hierarchy
    // -----------------------------------------------------------------------
    @GetMapping("/scripts/hierarchy")
    @SuppressWarnings("unchecked")
    public ResponseEntity<Map<String, Object>> getScriptsHierarchy() {
        try {
            ClassPathResource resource = new ClassPathResource("tree_hierachy_with_select_checkbox.json");
            ObjectMapper mapper = new ObjectMapper();
            Map<String, Object> response = mapper.readValue(resource.getInputStream(), Map.class);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    // -----------------------------------------------------------------------
    // Endpoint X1 – Squash proxy – Fetch folder by id
    // GET /app/EO7/api/testmanagement-task/squash/test-case-folders/{folderId}
    // -----------------------------------------------------------------------
    @GetMapping("/squash/test-case-folders/{folderId}")
    public ResponseEntity<String> getSquashFolder(
            @PathVariable("folderId") Long folderId,
            @RequestParam(value = "apiToken", required = false) String apiToken) {

        String url = squashApiBaseUrl + "/test-case-folders/" + folderId + "?fields=id,name";
        return forwardSquashRequest(url, HttpMethod.GET, null, apiToken);
    }

    // -----------------------------------------------------------------------
    // Endpoint X2 – Squash proxy – Create folder
    // POST /app/EO7/api/testmanagement-task/squash/test-case-folders
    // -----------------------------------------------------------------------
    @PostMapping("/squash/test-case-folders")
    public ResponseEntity<String> createSquashFolder(@RequestBody SquashCreateFolderRequest request) {
        if (request == null
                || request.name == null || request.name.isBlank()
                || request.description == null || request.description.isBlank()
                || request.parentId == null) {
            return ResponseEntity.badRequest().body("Failed: name, description and parentId are required.");
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("_type", "test-case-folder");
        body.put("name", request.name.trim());
        body.put("description", request.description.trim());

        Map<String, Object> parent = new LinkedHashMap<>();
        parent.put("_type", "test-case-folder");
        parent.put("id", request.parentId);
        body.put("parent", parent);

        String url = squashApiBaseUrl + "/test-case-folders";
        return forwardSquashRequest(url, HttpMethod.POST, body, request.apiToken);
    }

    // -----------------------------------------------------------------------
    // Endpoint X3 – Squash proxy – Save transformed test cases payload
    // POST /app/EO7/api/testmanagement-task/squash/test-cases
    // -----------------------------------------------------------------------
    @PostMapping("/squash/test-cases")
    public ResponseEntity<String> saveSquashTestCases(@RequestBody SquashSaveTestCasesRequest request) {
        if (request == null || request.payload == null || request.payload.isEmpty()) {
            return ResponseEntity.badRequest().body("Failed: payload is required.");
        }
        return forwardSquashRequest(squashTestCasesUrl, HttpMethod.POST, request.payload, request.apiToken);
    }

    private ResponseEntity<String> forwardSquashRequest(String url, HttpMethod method, Object body, String overrideApiToken) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        String resolvedToken = (overrideApiToken != null && !overrideApiToken.isBlank())
                ? overrideApiToken.trim()
                : squashApiToken;

        if (resolvedToken != null && !resolvedToken.isBlank()) {
            headers.set(HttpHeaders.AUTHORIZATION, toAuthorizationHeaderValue(resolvedToken));
        }

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

    private String toAuthorizationHeaderValue(String token) {
        String trimmed = token == null ? "" : token.trim();
        if (trimmed.startsWith("Bearer ") || trimmed.startsWith("Basic ")) {
            return trimmed;
        }
        return "Bearer " + trimmed;
    }

    private String stripTrailingSlash(String value) {
        if (value == null) {
            return "";
        }
        return value.endsWith("/")
                ? value.substring(0, value.length() - 1)
                : value;
    }

    static class SquashCreateFolderRequest {
        public String name;
        public String description;
        public Long parentId;
        public String apiToken;
    }

    static class SquashSaveTestCasesRequest {
        public List<Map<String, Object>> payload;
        public String apiToken;
    }
}

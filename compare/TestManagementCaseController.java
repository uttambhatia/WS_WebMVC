package com.ubs.testmanagement.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.time.LocalDate;

/**
 * Handles test management case-level operations.
 *
 * Endpoint 1  : POST /app/EO7/api/testmanagement-case/start             – create new case id
 * Endpoint 1.1: POST /app/EO7/api/testmanagement-case/list              – fetch list of case ids
 * Endpoint 2  : GET  /app/EO7/api/testmanagement-case/{caseId}/task     – get task id
 * Endpoint S1 : PUT  /app/EO7/api/testmanagement-case/{caseId}/snapshot – save stage data
 * Endpoint S2 : GET  /app/EO7/api/testmanagement-case/{caseId}/snapshot – load snapshot
 * Endpoint S3 : GET  /app/EO7/api/testmanagement-case/snapshots         – list all snapshots
 */
@RestController
@RequestMapping("/app/EO7/api/testmanagement-case")
public class TestManagementCaseController {

    // --- Mutable seed list so newly created IDs are included in /list ------
    private static final List<String> SEED_CASE_IDS = new ArrayList<>(
            Arrays.asList("TST-C001-A1B2C3D4", "TST-C001-E5F6G7H8"));

    /**
     * In-memory snapshot store.
     * Structure: caseId → { stageId → stageData, "_completedUpTo" → int }
     * The reserved "_completedUpTo" key is stripped before returning stageData to clients.
     */
    static final Map<String, Map<String, Object>> SNAPSHOTS = new ConcurrentHashMap<>();

    // -----------------------------------------------------------------------
    // Endpoint 1 – Create new test case id
    // POST /app/EO7/api/testmanagement-case/start?caseDefinitionKey=TST-C001
    // -----------------------------------------------------------------------
    @PostMapping("/start")
    public ResponseEntity<String> createCase(
            @RequestParam(name = "caseDefinitionKey", defaultValue = "TST-C001") String caseDefinitionKey) {

        String newCaseId = caseDefinitionKey + "-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        SEED_CASE_IDS.add(newCaseId);
        return ResponseEntity.ok(newCaseId);
    }

    // -----------------------------------------------------------------------
    // Endpoint 1.1 – Fetch list of test case ids
    // POST /app/EO7/api/testmanagement-case/list?caseDefinitionKey=TST-C001
    // -----------------------------------------------------------------------
    @PostMapping("/list")
    public ResponseEntity<List<String>> listCases(
            @RequestParam(name = "caseDefinitionKey", defaultValue = "TST-C001") String caseDefinitionKey) {

        return ResponseEntity.ok(SEED_CASE_IDS);
    }

    // -----------------------------------------------------------------------
    // Endpoint 2 – Create and get a task id for a given case
    // GET /app/EO7/api/testmanagement-case/{caseId}/task?processTaskId=ProcessTask_3
    // -----------------------------------------------------------------------
    @GetMapping("/{caseId}/task")
    public ResponseEntity<String> getTaskId(
            @PathVariable String caseId,
            @RequestParam(name = "processTaskId", defaultValue = "ProcessTask_3") String processTaskId) {

        String taskId = processTaskId + "-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        return ResponseEntity.ok(taskId);
    }

    // -----------------------------------------------------------------------
    // Endpoint S1 – Save one stage's form data for a case
    // PUT /app/EO7/api/testmanagement-case/{caseId}/snapshot
    // Body: { "stageId": "upload", "data": { ... }, "completedUpTo": 2 }
    // -----------------------------------------------------------------------
    @PutMapping("/{caseId}/snapshot")
    public ResponseEntity<String> saveSnapshot(
            @PathVariable String caseId,
            @RequestBody Map<String, Object> body) {

        String stageId = (String) body.get("stageId");
        Object data = body.get("data");
        if (stageId == null || data == null) {
            return ResponseEntity.badRequest().body("Failed: 'stageId' and 'data' are required.");
        }
        Map<String, Object> snapshot = SNAPSHOTS.computeIfAbsent(caseId, k -> new ConcurrentHashMap<>());
        snapshot.put(stageId, data);
        Object completedUpTo = body.get("completedUpTo");
        if (completedUpTo != null) {
            snapshot.put("_completedUpTo", completedUpTo);
        }
        return ResponseEntity.ok("Saved");
    }

    // -----------------------------------------------------------------------
    // Endpoint S2 – Load all saved stage data for a case
    // GET /app/EO7/api/testmanagement-case/{caseId}/snapshot
    // Returns: { "caseId": "...", "completedUpTo": 2, "stageData": { stageId: data, ... } }
    // -----------------------------------------------------------------------
    @GetMapping("/{caseId}/snapshot")
    public ResponseEntity<Map<String, Object>> loadSnapshot(@PathVariable String caseId) {
        Map<String, Object> snapshot = SNAPSHOTS.get(caseId);
        if (snapshot == null) {
            return ResponseEntity.notFound().build();
        }
        Map<String, Object> stageData = new HashMap<>(snapshot);
        Object completedUpTo = stageData.remove("_completedUpTo");

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("caseId", caseId);
        result.put("completedUpTo", completedUpTo != null ? completedUpTo : 0);
        result.put("stageData", stageData);
        return ResponseEntity.ok(result);
    }

    // -----------------------------------------------------------------------
    // Endpoint S3 – List all case IDs that have saved snapshots
    // GET /app/EO7/api/testmanagement-case/snapshots
    // Returns: [ { "caseId": "...", "completedUpTo": 2 }, ... ]
    // -----------------------------------------------------------------------
    @GetMapping("/snapshots")
    public ResponseEntity<List<Map<String, Object>>> listSnapshots() {
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map.Entry<String, Map<String, Object>> entry : SNAPSHOTS.entrySet()) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("caseId", entry.getKey());
            Object completedUpTo = entry.getValue().get("_completedUpTo");
            item.put("completedUpTo", completedUpTo != null ? completedUpTo : 0);
            result.add(item);
        }
        return ResponseEntity.ok(result);
    }

    @GetMapping("/{caseId}/comparison")
    public ResponseEntity<Map<String, Object>> getComparison(@PathVariable String caseId) {
        int hash = Math.abs(caseId.hashCode());
        LocalDate creationDate = LocalDate.of(2026, 1, 1).plusDays(hash % 120L);

        Map<String, Object> metrics = new LinkedHashMap<>();
        metrics.put("masterRqsScore", scaledMetric(hash, 0, 72.0, 98.0));
        metrics.put("answerCorrectness", scaledMetric(hash, 1, 68.0, 97.0));
        metrics.put("faithfulness", scaledMetric(hash, 2, 65.0, 96.0));
        metrics.put("relevancy", scaledMetric(hash, 3, 67.0, 98.0));
        metrics.put("contextPrecision", scaledMetric(hash, 4, 61.0, 94.0));
        metrics.put("contextRecall", scaledMetric(hash, 5, 60.0, 95.0));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("caseId", caseId);
        result.put("creationDate", creationDate.toString());
        result.put("winner", (hash % 3 == 0) ? "Yes" : "No");
        result.put("model", MODELS.get(hash % MODELS.size()));
        result.put("metrics", metrics);
        return ResponseEntity.ok(result);
    }

    private static final List<String> MODELS = Arrays.asList(
            "GPT-4.1",
            "Claude 3.7 Sonnet",
            "Gemini 2.5 Pro",
            "Llama 3.3 70B"
    );

    private static double scaledMetric(int hash, int salt, double min, double max) {
        int shifted = Math.abs(Integer.rotateLeft(hash, salt + 3));
        double ratio = (shifted % 1000) / 1000.0;
        double value = min + ((max - min) * ratio);
        return Math.round(value * 100.0) / 100.0;
    }
}

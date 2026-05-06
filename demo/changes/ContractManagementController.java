package com.ubs.testmanagement.controller;

import com.ubs.testmanagement.service.ContractManagementService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/app/EO7/api/contract-management")
public class ContractManagementController {

    private final ContractManagementService contractManagementService;

    public ContractManagementController(ContractManagementService contractManagementService) {
        this.contractManagementService = contractManagementService;
    }

    @PostMapping("/search")
    public ResponseEntity<Map<String, Object>> search(@RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(contractManagementService.search(body));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Map<String, Object>> updateRecord(
            @PathVariable String id,
            @RequestParam(defaultValue = "true") boolean statusTransitionEnabled,
            @RequestParam(defaultValue = "true") boolean auditingEnabled,
            @RequestBody Map<String, Object> payload) {

        return ResponseEntity.ok(contractManagementService.updateRecord(id, payload, statusTransitionEnabled, auditingEnabled));
    }

    @PostMapping("/{id}/submit")
    public ResponseEntity<Map<String, Object>> submitForReview(
            @PathVariable String id,
            @RequestParam(defaultValue = "false") boolean confirm,
            @RequestParam(defaultValue = "true") boolean statusTransitionEnabled,
            @RequestParam(defaultValue = "true") boolean auditingEnabled,
            @RequestParam(defaultValue = "ui-user") String actor) {

        return ResponseEntity.ok(
                contractManagementService.submitForReview(id, confirm, statusTransitionEnabled, auditingEnabled, actor));
    }

    @PostMapping("/{id}/approve")
    public ResponseEntity<Map<String, Object>> approve(
            @PathVariable String id,
            @RequestParam(defaultValue = "true") boolean statusTransitionEnabled,
            @RequestParam(defaultValue = "true") boolean auditingEnabled,
            @RequestParam(defaultValue = "reviewer") String actor,
            @RequestParam(defaultValue = "") String comment) {

        return ResponseEntity.ok(contractManagementService.approve(id, statusTransitionEnabled, auditingEnabled, actor, comment));
    }

    @PostMapping("/{id}/reject")
    public ResponseEntity<Map<String, Object>> reject(
            @PathVariable String id,
            @RequestParam(defaultValue = "true") boolean statusTransitionEnabled,
            @RequestParam(defaultValue = "true") boolean auditingEnabled,
            @RequestParam(defaultValue = "reviewer") String actor,
            @RequestParam(defaultValue = "") String comment) {

        return ResponseEntity.ok(contractManagementService.reject(id, statusTransitionEnabled, auditingEnabled, actor, comment));
    }

    @GetMapping("/{id}/audit")
    public ResponseEntity<List<Map<String, Object>>> getAudit(@PathVariable String id) {
        return ResponseEntity.ok(contractManagementService.getAuditTrail(id));
    }

    @GetMapping("/{id}/download")
    public ResponseEntity<byte[]> download(
            @PathVariable String id,
            @RequestParam(defaultValue = "csv") String format) {

        ContractManagementService.DownloadPayload payload = contractManagementService.download(id, format);

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + payload.fileName() + "\"")
                .header(HttpHeaders.CONTENT_TYPE, payload.contentType())
                .body(payload.bytes());
    }

    @ExceptionHandler({IllegalArgumentException.class, IllegalStateException.class})
    public ResponseEntity<Map<String, String>> handleBadRequest(RuntimeException exception) {
        return ResponseEntity.badRequest().body(Map.of("message", exception.getMessage()));
    }
}

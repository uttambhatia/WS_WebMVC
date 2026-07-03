package com.ubs.testmanagement.controller;

import com.ubs.testmanagement.service.ExecutionBootstrapVerificationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/app/EO7/api/test-execution")
public class ExecutionBootstrapController {

    private final ExecutionBootstrapVerificationService verificationService;

    public ExecutionBootstrapController(ExecutionBootstrapVerificationService verificationService) {
        this.verificationService = verificationService;
    }

    @GetMapping("/reference-data")
    public ResponseEntity<Map<String, Object>> getReferenceData() {
        return ResponseEntity.ok(verificationService.getReferenceDataSnapshot());
    }
}

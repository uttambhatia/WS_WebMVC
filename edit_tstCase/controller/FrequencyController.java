package com.ubs.testmanagement.controller;

import com.ubs.testmanagement.dto.FrequencyDto;
import com.ubs.testmanagement.service.FrequencyService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/app/EO7/api/frequencies")
public class FrequencyController {

    private final FrequencyService frequencyService;

    public FrequencyController(FrequencyService frequencyService) {
        this.frequencyService = frequencyService;
    }

    @GetMapping
    public ResponseEntity<List<FrequencyDto>> getAllFrequencies() {
        return ResponseEntity.ok(frequencyService.getAll());
    }

    @GetMapping("/search")
    public ResponseEntity<List<FrequencyDto>> searchFrequencies(
            @RequestParam(name = "name", required = false) String name) {
        return ResponseEntity.ok(frequencyService.searchByFrequencyName(name));
    }
}

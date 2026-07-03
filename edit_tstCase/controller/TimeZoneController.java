package com.ubs.testmanagement.controller;

import com.ubs.testmanagement.dto.TimeZoneMasterDto;
import com.ubs.testmanagement.service.TimeZoneService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/app/EO7/api/timezones")
public class TimeZoneController {

    private final TimeZoneService timeZoneService;

    public TimeZoneController(TimeZoneService timeZoneService) {
        this.timeZoneService = timeZoneService;
    }

    @GetMapping
    public ResponseEntity<List<TimeZoneMasterDto>> getAllTimezones() {
        return ResponseEntity.ok(timeZoneService.getAll());
    }

    @GetMapping("/search")
    public ResponseEntity<List<TimeZoneMasterDto>> searchTimezones(
            @RequestParam(name = "name", required = false) String name) {
        return ResponseEntity.ok(timeZoneService.searchByTimezoneName(name));
    }
}

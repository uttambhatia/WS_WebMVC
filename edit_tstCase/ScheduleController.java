package com.ubs.testmanagement.controller;

import com.ubs.testmanagement.dto.ScheduleDto;
import com.ubs.testmanagement.service.ScheduleService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * REST API for Schedule management.
 *
 * GET /api/v1/schedules/{scheduleId} - Get schedule details by ID
 */
@RestController
@RequestMapping("/api/v1")
public class ScheduleController {

    private final ScheduleService scheduleService;

    public ScheduleController(ScheduleService scheduleService) {
        this.scheduleService = scheduleService;
    }

    /**
     * Fetch schedule details by ID
     *
     * @param scheduleId The ID of the schedule to fetch
     * @return Schedule details as JSON or 404 if not found
     */
    @GetMapping("/schedules/{scheduleId}")
    public ResponseEntity<Map<String, Object>> getScheduleDetails(@PathVariable("scheduleId") Long scheduleId) {
        ScheduleDto schedule = scheduleService.getById(scheduleId);
        if (schedule == null) {
            return ResponseEntity.notFound().build();
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("schedule_id", schedule.getScheduleId());
        response.put("run_at", schedule.getRunAt());
        response.put("schedule_time", schedule.getScheduleTime());
        response.put("timezone_id", schedule.getTimezoneId());
        response.put("timezone_name", schedule.getTimezoneName());
        response.put("timezone_code", schedule.getTimezoneCode());
        response.put("recurring", schedule.getRecurring());
        response.put("frequency_id", schedule.getFrequencyId());
        response.put("frequency_name", schedule.getFrequencyName());
        response.put("frequency_code", schedule.getFrequencyCode());
        response.put("active", schedule.getActive());
        response.put("last_run_at", schedule.getLastRunAt());

        return ResponseEntity.ok(response);
    }
}

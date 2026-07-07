package com.ubs.testmanagement.controller;

import com.ubs.testmanagement.dto.PagedResponseDto;
import com.ubs.testmanagement.dto.ScheduleDto;
import com.ubs.testmanagement.service.ScheduleService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
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

    @GetMapping("/schedules")
    public ResponseEntity<Map<String, Object>> fetchSchedules(
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "10") int size,
            @RequestParam(name = "sortBy", defaultValue = "run_at") String sortBy,
            @RequestParam(name = "sortDirection", defaultValue = "desc") String sortDirection) {

        PagedResponseDto<ScheduleDto> pageResult = scheduleService.fetchAll(page, size, sortBy, sortDirection);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("content", pageResult.getContent());
        response.put("totalElements", pageResult.getTotalElements());
        response.put("page", pageResult.getPage());
        response.put("size", pageResult.getSize());
        response.put("totalPages", pageResult.getTotalPages());
        return ResponseEntity.ok(response);
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
        response.put("scripts_selected_count", schedule.getScriptsSelectedCount());
        response.put("selected_scripts", schedule.getSelectedScripts());

        return ResponseEntity.ok(response);
    }

    @PostMapping("/schedules/{scheduleId}/status")
    public ResponseEntity<Map<String, Object>> updateScheduleStatus(
            @PathVariable("scheduleId") Long scheduleId,
            @RequestBody Map<String, Object> payload) {
        Object activeRaw = payload.get("active");
        boolean active = Boolean.TRUE.equals(activeRaw) || "true".equalsIgnoreCase(String.valueOf(activeRaw));

        try {
            ScheduleDto updated = scheduleService.updateActiveStatus(scheduleId, active);
            return ResponseEntity.ok(Map.of(
                    "message", "Schedule status updated",
                    "schedule_id", updated.getScheduleId(),
                    "active", updated.getActive()
            ));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }
}

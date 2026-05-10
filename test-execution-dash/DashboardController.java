package com.ubs.testmanagement.controller;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

@RestController
public class DashboardController {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ISO_LOCAL_DATE;

    @GetMapping("/summary")
    public ResponseEntity<Map<String, Object>> getSummary(
            @RequestParam(name = "applicationId", required = false, defaultValue = "5") Integer applicationId,
            @RequestParam(name = "days", required = false) Integer days,
            @RequestParam(name = "startDate", required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(name = "endDate", required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(name = "period", required = false, defaultValue = "day") String period) {

        List<Map<String, Object>> trends = buildTrends(applicationId, period, days, startDate, endDate);

        int passed = 0;
        int failed = 0;
        int cancelled = 0;
        double totalDuration = 0;

        for (Map<String, Object> item : trends) {
            passed += asInt(item.get("passedCount"));
            failed += asInt(item.get("failedCount"));
            cancelled += asInt(item.get("cancelledCount"));
            totalDuration += asDouble(item.get("avgDurationMins"));
        }

        int totalExecutions = passed + failed + cancelled;
        double successRate = totalExecutions == 0 ? 0.0 : (passed * 100.0) / totalExecutions;
        double failureRate = totalExecutions == 0 ? 0.0 : 100.0 - successRate;
        double avgExecutionTimeMins = trends.isEmpty() ? 0.0 : totalDuration / trends.size();

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("totalFlowExecution", totalExecutions * 5);
        response.put("totalPipelineExecutions", totalExecutions);
        response.put("passedCount", passed);
        response.put("failedCount", failed);
        response.put("cancelCount", cancelled);
        response.put("successRate", round(successRate));
        response.put("failureRate", round(failureRate));
        response.put("avgExecutionTimeMins", round(avgExecutionTimeMins));

        return ResponseEntity.ok(response);
    }

    @GetMapping("/trends/pass-fail")
    public ResponseEntity<List<Map<String, Object>>> getPassFailTrends(
            @RequestParam(name = "period", required = false, defaultValue = "day") String period,
            @RequestParam(name = "days", required = false, defaultValue = "7") Integer days,
            @RequestParam(name = "applicationId", required = false, defaultValue = "5") Integer applicationId,
            @RequestParam(name = "startDate", required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(name = "endDate", required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {

        List<Map<String, Object>> response = buildTrends(applicationId, period, days, startDate, endDate);
        return ResponseEntity.ok(response);
    }

    private List<Map<String, Object>> buildTrends(
            Integer applicationId,
            String period,
            Integer days,
            LocalDate startDate,
            LocalDate endDate) {

        int safeAppId = applicationId == null ? 5 : Math.max(applicationId, 1);
        int safeDays = days == null ? 7 : Math.max(days, 1);

        LocalDate safeEnd = endDate != null ? endDate : LocalDate.now();
        LocalDate safeStart;

        if (startDate != null) {
            safeStart = startDate;
            if (endDate == null || endDate.isBefore(startDate)) {
                safeEnd = startDate.plusDays(safeDays - 1L);
            }
        } else {
            safeStart = safeEnd.minusDays(safeDays - 1L);
        }

        if (safeEnd.isBefore(safeStart)) {
            LocalDate temp = safeStart;
            safeStart = safeEnd;
            safeEnd = temp;
        }

        long diffDays = java.time.temporal.ChronoUnit.DAYS.between(safeStart, safeEnd) + 1;
        int totalPoints = (int) Math.max(1, diffDays);

        List<Map<String, Object>> rows = new ArrayList<>(totalPoints);

        for (int i = 0; i < totalPoints; i++) {
            LocalDate cursor = safeStart.plusDays(i);
            long seed = safeAppId * 10_000L + cursor.toEpochDay();
            Random random = new Random(seed);

            int failedCount = 12 + random.nextInt(70);
            int passedCount = 8 + random.nextInt(65);
            int cancelledCount = random.nextInt(8);
            int totalCount = passedCount + failedCount + cancelledCount;
            double successRate = totalCount == 0 ? 0.0 : (passedCount * 100.0) / totalCount;
            double avgDurationMins = 18 + random.nextDouble() * 220;

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("date", DATE_FMT.format(cursor));
            row.put("period", normalizePeriod(period, cursor));
            row.put("passedCount", passedCount);
            row.put("failedCount", failedCount);
            row.put("cancelledCount", cancelledCount);
            row.put("totalCount", totalCount);
            row.put("successRate", round(successRate));
            row.put("avgDurationMins", round(avgDurationMins));

            rows.add(row);
        }

        return rows;
    }

    private String normalizePeriod(String period, LocalDate date) {
        String safePeriod = period == null ? "day" : period.trim().toLowerCase();
        if ("month".equals(safePeriod)) {
            return String.format("%04d-%02d", date.getYear(), date.getMonthValue());
        }
        if ("week".equals(safePeriod)) {
            java.time.LocalDate monday = date.minusDays((date.getDayOfWeek().getValue() + 6L) % 7L);
            return DATE_FMT.format(monday);
        }
        return DATE_FMT.format(date);
    }

    private int asInt(Object value) {
        if (value instanceof Number n) {
            return n.intValue();
        }
        return 0;
    }

    private double asDouble(Object value) {
        if (value instanceof Number n) {
            return n.doubleValue();
        }
        return 0.0;
    }

    private double round(double value) {
        return Math.round(value * 1000.0) / 1000.0;
    }
}

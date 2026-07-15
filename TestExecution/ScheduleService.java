package com.ubs.testmanagement.service;

import com.ubs.testmanagement.dto.ScheduleDto;
import com.ubs.testmanagement.dto.PagedResponseDto;
import com.ubs.testmanagement.entity.ExecutionItem;
import com.ubs.testmanagement.entity.Frequency;
import com.ubs.testmanagement.entity.Schedule;
import com.ubs.testmanagement.entity.TimeZoneMaster;
import com.ubs.testmanagement.repository.ExecutionItemRepository;
import com.ubs.testmanagement.repository.FrequencyRepository;
import com.ubs.testmanagement.repository.ScheduleRepository;
import com.ubs.testmanagement.repository.TimeZoneMasterRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

@Service
public class ScheduleService {

    private final ScheduleRepository scheduleRepository;
    private final ExecutionItemRepository executionItemRepository;
    private final FrequencyRepository frequencyRepository;
    private final TimeZoneMasterRepository timeZoneMasterRepository;

    public ScheduleService(ScheduleRepository scheduleRepository,
                           ExecutionItemRepository executionItemRepository,
                           FrequencyRepository frequencyRepository,
                           TimeZoneMasterRepository timeZoneMasterRepository) {
        this.scheduleRepository = scheduleRepository;
        this.executionItemRepository = executionItemRepository;
        this.frequencyRepository = frequencyRepository;
        this.timeZoneMasterRepository = timeZoneMasterRepository;
    }

    /**
     * Persists a new schedule from the frontend payload.
     *
     * Expected payload keys:
     *   run_at_iso  – ISO-8601 datetime string; time portion becomes schedule_time
     *   recurring   – boolean; if true, frequency is required
     *   timezone    – map with timezone_id (number) and/or timezone_code (string)
     *   frequency   – map with frequency_id (number) and/or frequency_code (string), or null
     */
    @Transactional
    public ScheduleDto save(Map<String, Object> payload) {

        // ---- resolve timezone ----
        Map<?, ?> tzMap = (Map<?, ?>) payload.get("timezone");
        if (tzMap == null) {
            throw new IllegalArgumentException("timezone is required");
        }
        TimeZoneMaster timezone = resolveTimezone(tzMap);

        // ---- parse run_at as UTC LocalDateTime (used for job trigger comparison) ----
        LocalDateTime runAtUtc = parseRunAtUtc(payload, timezone);

        // schedule_time = wall-clock time in the configured timezone
        ZoneId scheduleZone;
        try {
            scheduleZone = ZoneId.of(timezone.getTimezoneCode());
        } catch (Exception e) {
            scheduleZone = ZoneId.of("UTC");
        }
        LocalTime scheduleTime = runAtUtc.atZone(ZoneId.of("UTC")).withZoneSameInstant(scheduleZone).toLocalTime();

        // ---- resolve frequency (optional for non-recurring) ----
        Boolean recurring = Boolean.TRUE.equals(payload.get("recurring"));
        Frequency frequency = null;
        if (recurring) {
            Map<?, ?> freqMap = (Map<?, ?>) payload.get("frequency");
            if (freqMap == null) {
                throw new IllegalArgumentException("frequency is required for recurring schedules");
            }
            frequency = resolveFrequency(freqMap);
        }

        // ---- build and save entity ----
        Schedule schedule = new Schedule();
        schedule.setTimezone(timezone);
        schedule.setScheduleTime(scheduleTime);
        schedule.setFrequency(frequency);
        schedule.setActive(true);
        schedule.setRecurring(recurring);
        schedule.setRunAt(runAtUtc);

        Schedule saved = scheduleRepository.save(schedule);

        // ---- save selected scripts as execution items linked to this schedule ----
        Object scriptPathsRaw = payload.get("script_paths");
        if (scriptPathsRaw instanceof List<?> scriptPaths) {
            int order = 0;
            for (Object pathObj : scriptPaths) {
                String scriptPath = pathObj != null ? pathObj.toString() : null;
                if (scriptPath == null || scriptPath.isBlank()) continue;
                ExecutionItem item = new ExecutionItem();
                item.setSchedule(saved);
                item.setExecScript(scriptPath);
                item.setScriptOrder(order++);
                item.setStatus("SCHEDULED");
                executionItemRepository.save(item);
            }
        }

        return toDto(saved);
    }

    @Transactional(readOnly = true)
    public PagedResponseDto<ScheduleDto> fetchAll(int page, int size, String sortBy, String sortDirection) {
        Pageable pageable = PageRequest.of(
                Math.max(page, 0),
                Math.max(size, 1),
                Sort.by("asc".equalsIgnoreCase(sortDirection) ? Sort.Direction.ASC : Sort.Direction.DESC, normalizeSortBy(sortBy)));

        Page<Schedule> resultPage = scheduleRepository.findAll(pageable);
        List<ScheduleDto> content = resultPage.getContent().stream().map(this::toDto).toList();

        return new PagedResponseDto<>(
                content,
                resultPage.getNumber(),
                resultPage.getSize(),
                resultPage.getTotalElements(),
                resultPage.getTotalPages());
    }

    @Transactional
    public ScheduleDto updateActiveStatus(Long scheduleId, boolean active) {
        Schedule schedule = scheduleRepository.findById(scheduleId)
                .orElseThrow(() -> new IllegalArgumentException("Schedule not found for id: " + scheduleId));
        schedule.setActive(active);
        Schedule saved = scheduleRepository.save(schedule);
        return toDto(saved);
    }

    private TimeZoneMaster resolveTimezone(Map<?, ?> tzMap) {
        Object idObj = tzMap.get("timezone_id");
        if (idObj != null) {
            short id = ((Number) idObj).shortValue();
            return timeZoneMasterRepository.findById(id)
                    .orElseThrow(() -> new IllegalArgumentException("Timezone not found for id: " + id));
        }
        String code = (String) tzMap.get("timezone_code");
        if (code != null && !code.isBlank()) {
            return timeZoneMasterRepository.findByTimezoneCode(code)
                    .orElseThrow(() -> new IllegalArgumentException("Timezone not found for code: " + code));
        }
        throw new IllegalArgumentException("timezone must have timezone_id or timezone_code");
    }

    private LocalDateTime parseRunAtUtc(Map<String, Object> payload, TimeZoneMaster timezone) {
        String runAtIso = asString(payload.get("run_at_iso"));
        if (runAtIso != null && !runAtIso.isBlank()) {
            try {
                return OffsetDateTime.parse(runAtIso.trim())
                        .toInstant()
                        .atZone(ZoneId.of("UTC"))
                        .toLocalDateTime();
            } catch (Exception ignored) {
                // Fall through to other accepted formats.
            }
        }

        String runAt = asString(payload.get("run_at"));
        if (runAt == null || runAt.isBlank()) {
            throw new IllegalArgumentException("run_at_iso is required");
        }

        try {
            return OffsetDateTime.parse(runAt.trim())
                    .toInstant()
                    .atZone(ZoneId.of("UTC"))
                    .toLocalDateTime();
        } catch (Exception ignored) {
            try {
                LocalDateTime localDateTime = LocalDateTime.parse(runAt.trim());
                ZoneId scheduleZone;
                try {
                    scheduleZone = ZoneId.of(timezone.getTimezoneCode());
                } catch (Exception e) {
                    scheduleZone = ZoneId.of("UTC");
                }
                return localDateTime.atZone(scheduleZone)
                        .withZoneSameInstant(ZoneId.of("UTC"))
                        .toLocalDateTime();
            } catch (Exception ex) {
                throw new IllegalArgumentException("run_at_iso is required");
            }
        }
    }

    private String asString(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private Frequency resolveFrequency(Map<?, ?> freqMap) {
        Object idObj = freqMap.get("frequency_id");
        if (idObj != null) {
            short id = ((Number) idObj).shortValue();
            return frequencyRepository.findById(id)
                    .orElseThrow(() -> new IllegalArgumentException("Frequency not found for id: " + id));
        }
        String code = (String) freqMap.get("frequency_code");
        if (code != null && !code.isBlank()) {
            return frequencyRepository.findByFrequencyCode(code)
                    .orElseThrow(() -> new IllegalArgumentException("Frequency not found for code: " + code));
        }
        throw new IllegalArgumentException("frequency must have frequency_id or frequency_code");
    }

    private ScheduleDto toDto(Schedule entity) {
        ScheduleDto dto = new ScheduleDto();
        dto.setScheduleId(entity.getScheduleId());
        dto.setScheduleTime(entity.getScheduleTime());
        dto.setActive(entity.getActive());
        dto.setRecurring(entity.getRecurring());
        dto.setRunAt(entity.getRunAt());
        dto.setLastRunAt(entity.getLastRunAt());
        if (entity.getTimezone() != null) {
            dto.setTimezoneId(entity.getTimezone().getTimezoneId());
            dto.setTimezoneName(entity.getTimezone().getTimezoneName());
            dto.setTimezoneCode(entity.getTimezone().getTimezoneCode());
        }
        if (entity.getFrequency() != null) {
            dto.setFrequencyId(entity.getFrequency().getFrequencyId());
            dto.setFrequencyName(entity.getFrequency().getFrequencyName());
            dto.setFrequencyCode(entity.getFrequency().getFrequencyCode());
        }

        List<ExecutionItem> linkedItems = executionItemRepository.findBySchedule_ScheduleIdOrderByScriptOrder(entity.getScheduleId());
        List<String> selectedScripts = new ArrayList<>();
        for (ExecutionItem item : linkedItems) {
            if (item.getExecScript() != null && !item.getExecScript().isBlank()) {
                selectedScripts.add(item.getExecScript());
            }
        }
        dto.setSelectedScripts(selectedScripts);
        dto.setScriptsSelectedCount(selectedScripts.size());
        return dto;
    }

    public ScheduleDto getById(Long scheduleId) {
        Schedule schedule = scheduleRepository.findById(scheduleId).orElse(null);
        if (schedule == null) {
            return null;
        }
        return toDto(schedule);
    }

    private String normalizeSortBy(String sortBy) {
        if (sortBy == null || sortBy.isBlank()) {
            return "runAt";
        }
        return switch (sortBy) {
            case "schedule_id" -> "scheduleId";
            case "run_at" -> "runAt";
            case "schedule_time" -> "scheduleTime";
            case "last_run_at" -> "lastRunAt";
            case "active" -> "active";
            case "recurring" -> "recurring";
            default -> "runAt";
        };
    }
}

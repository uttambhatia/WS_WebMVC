package com.ubs.testmanagement.service;

import com.ubs.testmanagement.dto.ScheduleDto;
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
import java.util.List;
import java.util.Map;

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
        String runAtIso = (String) payload.get("run_at_iso");
        if (runAtIso == null || runAtIso.isBlank()) {
            throw new IllegalArgumentException("run_at_iso is required");
        }
        OffsetDateTime runAtOffset = OffsetDateTime.parse(runAtIso);
        LocalDateTime runAtUtc = runAtOffset.toInstant()
                .atZone(ZoneId.of("UTC"))
                .toLocalDateTime();

        // schedule_time = wall-clock time in the configured timezone
        ZoneId scheduleZone;
        try {
            scheduleZone = ZoneId.of(timezone.getTimezoneCode());
        } catch (Exception e) {
            scheduleZone = ZoneId.of("UTC");
        }
        LocalTime scheduleTime = runAtOffset.atZoneSameInstant(scheduleZone).toLocalTime();

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
        return dto;
    }

    public ScheduleDto getById(Long scheduleId) {
        Schedule schedule = scheduleRepository.findById(scheduleId).orElse(null);
        if (schedule == null) {
            return null;
        }
        return toDto(schedule);
    }
}

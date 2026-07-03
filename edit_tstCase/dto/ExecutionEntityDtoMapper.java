package com.ubs.testmanagement.dto;

import com.ubs.testmanagement.entity.ExecutionItem;
import com.ubs.testmanagement.entity.Frequency;
import com.ubs.testmanagement.entity.Schedule;
import com.ubs.testmanagement.entity.TestExecution;
import com.ubs.testmanagement.entity.TimeZoneMaster;

public final class ExecutionEntityDtoMapper {

    private ExecutionEntityDtoMapper() {
    }

    public static FrequencyDto toDto(Frequency entity) {
        if (entity == null) {
            return null;
        }

        FrequencyDto dto = new FrequencyDto();
        dto.setFrequencyId(entity.getFrequencyId());
        dto.setFrequencyCode(entity.getFrequencyCode());
        dto.setFrequencyName(entity.getFrequencyName());
        return dto;
    }

    public static TimeZoneMasterDto toDto(TimeZoneMaster entity) {
        if (entity == null) {
            return null;
        }

        TimeZoneMasterDto dto = new TimeZoneMasterDto();
        dto.setTimezoneId(entity.getTimezoneId());
        dto.setTimezoneCode(entity.getTimezoneCode());
        dto.setTimezoneName(entity.getTimezoneName());
        return dto;
    }

    public static ScheduleDto toDto(Schedule entity) {
        if (entity == null) {
            return null;
        }

        ScheduleDto dto = new ScheduleDto();
        dto.setScheduleId(entity.getScheduleId());
        dto.setFrequencyId(entity.getFrequency() != null ? entity.getFrequency().getFrequencyId() : null);
        dto.setScheduleTime(entity.getScheduleTime());
        dto.setTimezoneId(entity.getTimezone() != null ? entity.getTimezone().getTimezoneId() : null);
        dto.setActive(entity.getActive());
        return dto;
    }

    public static TestExecutionDto toDto(TestExecution entity) {
        if (entity == null) {
            return null;
        }

        TestExecutionDto dto = new TestExecutionDto();
        dto.setExecutionId(entity.getExecutionId());
        dto.setTestId(entity.getTestId());
        dto.setRunType(entity.getRunType());
        dto.setStatus(entity.getStatus());
        dto.setErrorMessage(entity.getErrorMessage());
        dto.setScheduleId(entity.getSchedule() != null ? entity.getSchedule().getScheduleId() : null);
        dto.setStartedAt(entity.getStartedAt());
        dto.setFinishedAt(entity.getFinishedAt());
        dto.setCreatedAt(entity.getCreatedAt());
        dto.setPassed(entity.getPassed());
        dto.setFailed(entity.getFailed());
        dto.setError(entity.getError());
        dto.setSkipped(entity.getSkipped());
        dto.setTotal(entity.getTotal());
        dto.setExecutionItems(entity.getExecutionItems() == null
            ? java.util.List.of()
            : entity.getExecutionItems().stream().map(ExecutionEntityDtoMapper::toDto).toList());
        return dto;
    }

    public static ExecutionItemDto toDto(ExecutionItem entity) {
        if (entity == null) {
            return null;
        }

        ExecutionItemDto dto = new ExecutionItemDto();
        dto.setItemId(entity.getItemId());
        dto.setExecCaseId(entity.getExecCaseId());
        dto.setExecCaseName(entity.getExecCaseName());
        dto.setExecScript(entity.getExecScript());
        dto.setScheduleId(entity.getSchedule() != null ? entity.getSchedule().getScheduleId() : null);
        dto.setExecutionId(entity.getExecution() != null ? entity.getExecution().getExecutionId() : null);
        dto.setScriptOrder(entity.getScriptOrder());
        dto.setStatus(entity.getStatus());
        dto.setError(entity.getError());
        dto.setDurationSeconds(entity.getDurationSeconds());
        return dto;
    }
}

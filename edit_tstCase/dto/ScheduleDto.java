package com.ubs.testmanagement.dto;

import java.time.LocalTime;

public class ScheduleDto {

    private Long scheduleId;
    private Short frequencyId;
    private LocalTime scheduleTime;
    private Short timezoneId;
    private Boolean active;

    public ScheduleDto() {
    }

    public Long getScheduleId() {
        return scheduleId;
    }

    public void setScheduleId(Long scheduleId) {
        this.scheduleId = scheduleId;
    }

    public Short getFrequencyId() {
        return frequencyId;
    }

    public void setFrequencyId(Short frequencyId) {
        this.frequencyId = frequencyId;
    }

    public LocalTime getScheduleTime() {
        return scheduleTime;
    }

    public void setScheduleTime(LocalTime scheduleTime) {
        this.scheduleTime = scheduleTime;
    }

    public Short getTimezoneId() {
        return timezoneId;
    }

    public void setTimezoneId(Short timezoneId) {
        this.timezoneId = timezoneId;
    }

    public Boolean getActive() {
        return active;
    }

    public void setActive(Boolean active) {
        this.active = active;
    }
}

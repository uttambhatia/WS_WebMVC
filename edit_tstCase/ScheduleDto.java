package com.ubs.testmanagement.dto;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

public class ScheduleDto {

    private Long scheduleId;
    private Short frequencyId;
    private String frequencyName;
    private String frequencyCode;
    private LocalTime scheduleTime;
    private Short timezoneId;
    private String timezoneName;
    private String timezoneCode;
    private Boolean active;
    private Boolean recurring;
    private LocalDateTime runAt;
    private LocalDateTime lastRunAt;
    private Integer scriptsSelectedCount;
    private List<String> selectedScripts = new ArrayList<>();

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

    public String getFrequencyName() {
        return frequencyName;
    }

    public void setFrequencyName(String frequencyName) {
        this.frequencyName = frequencyName;
    }

    public String getFrequencyCode() {
        return frequencyCode;
    }

    public void setFrequencyCode(String frequencyCode) {
        this.frequencyCode = frequencyCode;
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

    public String getTimezoneName() {
        return timezoneName;
    }

    public void setTimezoneName(String timezoneName) {
        this.timezoneName = timezoneName;
    }

    public String getTimezoneCode() {
        return timezoneCode;
    }

    public void setTimezoneCode(String timezoneCode) {
        this.timezoneCode = timezoneCode;
    }

    public Boolean getActive() {
        return active;
    }

    public void setActive(Boolean active) {
        this.active = active;
    }

    public Boolean getRecurring() {
        return recurring;
    }

    public void setRecurring(Boolean recurring) {
        this.recurring = recurring;
    }

    public LocalDateTime getRunAt() {
        return runAt;
    }

    public void setRunAt(LocalDateTime runAt) {
        this.runAt = runAt;
    }

    public LocalDateTime getLastRunAt() {
        return lastRunAt;
    }

    public void setLastRunAt(LocalDateTime lastRunAt) {
        this.lastRunAt = lastRunAt;
    }

    public Integer getScriptsSelectedCount() {
        return scriptsSelectedCount;
    }

    public void setScriptsSelectedCount(Integer scriptsSelectedCount) {
        this.scriptsSelectedCount = scriptsSelectedCount;
    }

    public List<String> getSelectedScripts() {
        return selectedScripts;
    }

    public void setSelectedScripts(List<String> selectedScripts) {
        this.selectedScripts = selectedScripts;
    }
}

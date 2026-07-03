package com.ubs.testmanagement.dto;

public class TimeZoneMasterDto {

    private Short timezoneId;
    private String timezoneCode;
    private String timezoneName;

    public TimeZoneMasterDto() {
    }

    public Short getTimezoneId() {
        return timezoneId;
    }

    public void setTimezoneId(Short timezoneId) {
        this.timezoneId = timezoneId;
    }

    public String getTimezoneCode() {
        return timezoneCode;
    }

    public void setTimezoneCode(String timezoneCode) {
        this.timezoneCode = timezoneCode;
    }

    public String getTimezoneName() {
        return timezoneName;
    }

    public void setTimezoneName(String timezoneName) {
        this.timezoneName = timezoneName;
    }
}

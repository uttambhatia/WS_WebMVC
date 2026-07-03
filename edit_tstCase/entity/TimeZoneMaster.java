package com.ubs.testmanagement.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "mst_timezone")
public class TimeZoneMaster {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "timezone_id")
    private Short timezoneId;

    @Column(name = "timezone_code", nullable = false, unique = true, length = 100)
    private String timezoneCode;

    @Column(name = "timezone_name", length = 100)
    private String timezoneName;

    public TimeZoneMaster() {
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

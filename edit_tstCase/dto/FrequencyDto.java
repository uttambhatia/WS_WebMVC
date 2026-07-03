package com.ubs.testmanagement.dto;

public class FrequencyDto {

    private Short frequencyId;
    private String frequencyCode;
    private String frequencyName;

    public FrequencyDto() {
    }

    public Short getFrequencyId() {
        return frequencyId;
    }

    public void setFrequencyId(Short frequencyId) {
        this.frequencyId = frequencyId;
    }

    public String getFrequencyCode() {
        return frequencyCode;
    }

    public void setFrequencyCode(String frequencyCode) {
        this.frequencyCode = frequencyCode;
    }

    public String getFrequencyName() {
        return frequencyName;
    }

    public void setFrequencyName(String frequencyName) {
        this.frequencyName = frequencyName;
    }
}

package com.ubs.testmanagement.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "mst_frequency")
public class Frequency {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "frequency_id")
    private Short frequencyId;

    @Column(name = "frequency_code", nullable = false, unique = true, length = 20)
    private String frequencyCode;

    @Column(name = "frequency_name", nullable = false, length = 50)
    private String frequencyName;

    public Frequency() {
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

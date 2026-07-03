package com.ubs.testmanagement.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Lob;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(
    name = "execution_items",
    uniqueConstraints = @UniqueConstraint(name = "uq_execution_script_order", columnNames = {"execution_id", "script_order"})
)
public class ExecutionItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "item_id")
    private Long itemId;

    @Column(name = "exec_case_id", length = 100)
    private String execCaseId;

    @Column(name = "exec_case_name", length = 255)
    private String execCaseName;

    @Lob
    @Column(name = "exec_script")
    private String execScript;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "schedule_id")
    private Schedule schedule;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "execution_id")
    private TestExecution execution;

    @Column(name = "script_order")
    private Integer scriptOrder;

    @Column(name = "status", length = 20)
    private String status;

    @Lob
    @Column(name = "error")
    private String error;

    @Column(name = "duration_seconds")
    private Integer durationSeconds;

    public ExecutionItem() {
    }

    public Long getItemId() {
        return itemId;
    }

    public void setItemId(Long itemId) {
        this.itemId = itemId;
    }

    public String getExecCaseId() {
        return execCaseId;
    }

    public void setExecCaseId(String execCaseId) {
        this.execCaseId = execCaseId;
    }

    public String getExecCaseName() {
        return execCaseName;
    }

    public void setExecCaseName(String execCaseName) {
        this.execCaseName = execCaseName;
    }

    public String getExecScript() {
        return execScript;
    }

    public void setExecScript(String execScript) {
        this.execScript = execScript;
    }

    public Schedule getSchedule() {
        return schedule;
    }

    public void setSchedule(Schedule schedule) {
        this.schedule = schedule;
    }

    public TestExecution getExecution() {
        return execution;
    }

    public void setExecution(TestExecution execution) {
        this.execution = execution;
    }

    public Integer getScriptOrder() {
        return scriptOrder;
    }

    public void setScriptOrder(Integer scriptOrder) {
        this.scriptOrder = scriptOrder;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getError() {
        return error;
    }

    public void setError(String error) {
        this.error = error;
    }

    public Integer getDurationSeconds() {
        return durationSeconds;
    }

    public void setDurationSeconds(Integer durationSeconds) {
        this.durationSeconds = durationSeconds;
    }
}

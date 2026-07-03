package com.ubs.testmanagement.dto;

public class ExecutionItemDto {

    private Long itemId;
    private String execCaseId;
    private String execCaseName;
    private String execScript;
    private Long scheduleId;
    private Long executionId;
    private Integer scriptOrder;
    private String status;
    private String error;
    private Integer durationSeconds;

    public ExecutionItemDto() {
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

    public Long getScheduleId() {
        return scheduleId;
    }

    public void setScheduleId(Long scheduleId) {
        this.scheduleId = scheduleId;
    }

    public Long getExecutionId() {
        return executionId;
    }

    public void setExecutionId(Long executionId) {
        this.executionId = executionId;
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

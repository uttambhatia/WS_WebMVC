package com.ubs.testmanagement.repository;

import com.ubs.testmanagement.entity.ExecutionItem;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ExecutionItemRepository extends JpaRepository<ExecutionItem, Long> {

    List<ExecutionItem> findByExecutionExecutionIdOrderByScriptOrderAsc(Long executionId);

    List<ExecutionItem> findBySchedule_ScheduleIdOrderByScriptOrder(Long scheduleId);
}

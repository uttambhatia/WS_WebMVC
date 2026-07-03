package com.ubs.testmanagement.repository;

import com.ubs.testmanagement.entity.TestExecution;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface TestExecutionRepository extends JpaRepository<TestExecution, Long>, JpaSpecificationExecutor<TestExecution> {

    List<TestExecution> findByTestId(String testId);

    List<TestExecution> findByStatus(String status);
}

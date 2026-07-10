package com.ubs.testmanagement.repository;

import com.ubs.testmanagement.entity.RunType;
import com.ubs.testmanagement.entity.TestExecution;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TestExecutionRepository extends JpaRepository<TestExecution, Long>, JpaSpecificationExecutor<TestExecution> {

    List<TestExecution> findByTestId(String testId);

    List<TestExecution> findByStatus(String status);

        @Query("""
                        SELECT e
                        FROM TestExecution e
                        WHERE e.runType = :runType
                            AND e.testId IS NOT NULL
                            AND e.testId <> ''
                            AND lower(e.status) IN :statuses
                        ORDER BY COALESCE(e.startedAt, e.createdAt) ASC
                        """)
        List<TestExecution> findPollableScheduledExecutions(@Param("runType") RunType runType,
                                                                                                                @Param("statuses") List<String> statuses,
                                                                                                                Pageable pageable);

        @Modifying(clearAutomatically = true, flushAutomatically = true)
        @Query("""
                        UPDATE TestExecution e
                        SET e.status = :nextStatus,
                                e.startedAt = COALESCE(:startedAt, e.startedAt),
                                e.finishedAt = COALESCE(:finishedAt, e.finishedAt),
                                e.errorMessage = COALESCE(:errorMessage, e.errorMessage),
                                e.passed = :passed,
                                e.failed = :failed,
                                e.error = :error,
                                e.skipped = :skipped,
                                e.total = :total
                        WHERE e.executionId = :executionId
                            AND lower(e.status) = :currentStatus
                        """)
        int updateStatusIfCurrent(@Param("executionId") Long executionId,
                                                            @Param("currentStatus") String currentStatus,
                                                            @Param("nextStatus") String nextStatus,
                                                            @Param("startedAt") LocalDateTime startedAt,
                                                            @Param("finishedAt") LocalDateTime finishedAt,
                                                            @Param("errorMessage") String errorMessage,
                                                            @Param("passed") Integer passed,
                                                            @Param("failed") Integer failed,
                                                            @Param("error") Integer error,
                                                            @Param("skipped") Integer skipped,
                                                            @Param("total") Integer total);
}

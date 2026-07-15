package com.ubs.testmanagement.repository;

import com.ubs.testmanagement.entity.Schedule;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ScheduleRepository extends JpaRepository<Schedule, Long> {

    List<Schedule> findByActiveTrue();

    @Query("SELECT s FROM Schedule s LEFT JOIN FETCH s.frequency LEFT JOIN FETCH s.timezone WHERE s.active = true AND s.runAt IS NOT NULL AND s.runAt <= :now")
    List<Schedule> findDueSchedules(@Param("now") LocalDateTime now);

    /**
     * Atomically advances run_at for a recurring schedule.
     * Returns 1 if updated (this caller won the race), 0 if already advanced by another thread.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE Schedule s SET s.runAt = :nextRunAt, s.lastRunAt = :lastRunAt WHERE s.scheduleId = :id AND s.active = true AND s.runAt <= :boundary")
    int advanceRunAt(@Param("id") Long id,
                     @Param("nextRunAt") LocalDateTime nextRunAt,
                     @Param("lastRunAt") LocalDateTime lastRunAt,
                     @Param("boundary") LocalDateTime boundary);

    /**
     * Atomically deactivates a one-off schedule.
     * Returns 1 if updated, 0 if already deactivated by another thread.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE Schedule s SET s.active = false, s.lastRunAt = :lastRunAt WHERE s.scheduleId = :id AND s.active = true")
    int deactivate(@Param("id") Long id, @Param("lastRunAt") LocalDateTime lastRunAt);
}

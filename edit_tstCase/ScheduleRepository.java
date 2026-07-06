package com.ubs.testmanagement.repository;

import com.ubs.testmanagement.entity.Schedule;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ScheduleRepository extends JpaRepository<Schedule, Long> {

    List<Schedule> findByActiveTrue();

    @Query("SELECT s FROM Schedule s WHERE s.active = true AND s.runAt IS NOT NULL AND s.runAt <= :now")
    List<Schedule> findDueSchedules(@Param("now") LocalDateTime now);
}

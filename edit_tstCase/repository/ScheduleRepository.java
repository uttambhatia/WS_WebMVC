package com.ubs.testmanagement.repository;

import com.ubs.testmanagement.entity.Schedule;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ScheduleRepository extends JpaRepository<Schedule, Long> {

    List<Schedule> findByActiveTrue();
}

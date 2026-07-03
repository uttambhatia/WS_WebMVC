package com.ubs.testmanagement.repository;

import com.ubs.testmanagement.entity.TimeZoneMaster;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TimeZoneMasterRepository extends JpaRepository<TimeZoneMaster, Short> {

    Optional<TimeZoneMaster> findByTimezoneCode(String timezoneCode);

    List<TimeZoneMaster> findByTimezoneNameContainingIgnoreCaseOrderByTimezoneNameAsc(String timezoneName);
}

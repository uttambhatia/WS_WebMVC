package com.ubs.testmanagement.repository;

import com.ubs.testmanagement.entity.Frequency;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FrequencyRepository extends JpaRepository<Frequency, Short> {

    Optional<Frequency> findByFrequencyCode(String frequencyCode);

    List<Frequency> findByFrequencyNameContainingIgnoreCaseOrderByFrequencyNameAsc(String frequencyName);
}

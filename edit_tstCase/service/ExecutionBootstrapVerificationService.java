package com.ubs.testmanagement.service;

import com.ubs.testmanagement.repository.FrequencyRepository;
import com.ubs.testmanagement.repository.TimeZoneMasterRepository;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class ExecutionBootstrapVerificationService {

    private final FrequencyRepository frequencyRepository;
    private final TimeZoneMasterRepository timeZoneMasterRepository;

    public ExecutionBootstrapVerificationService(
            FrequencyRepository frequencyRepository,
            TimeZoneMasterRepository timeZoneMasterRepository) {
        this.frequencyRepository = frequencyRepository;
        this.timeZoneMasterRepository = timeZoneMasterRepository;
    }

    public Map<String, Object> getReferenceDataSnapshot() {
        List<Map<String, Object>> frequencies = frequencyRepository.findAll().stream()
                .map(frequency -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("id", frequency.getFrequencyId());
                    row.put("code", frequency.getFrequencyCode());
                    row.put("name", frequency.getFrequencyName());
                    return row;
                })
                .collect(Collectors.toList());

        List<Map<String, Object>> timezones = timeZoneMasterRepository.findAll().stream()
                .map(timezone -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("id", timezone.getTimezoneId());
                    row.put("code", timezone.getTimezoneCode());
                    row.put("name", timezone.getTimezoneName());
                    return row;
                })
                .collect(Collectors.toList());

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("frequencyCount", frequencies.size());
        response.put("timezoneCount", timezones.size());
        response.put("frequencies", frequencies);
        response.put("timezones", timezones);
        response.put("seedDataLoaded", !frequencies.isEmpty() && !timezones.isEmpty());
        return response;
    }
}

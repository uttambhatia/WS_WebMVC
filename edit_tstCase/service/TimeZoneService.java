package com.ubs.testmanagement.service;

import com.ubs.testmanagement.dto.ExecutionEntityDtoMapper;
import com.ubs.testmanagement.dto.TimeZoneMasterDto;
import com.ubs.testmanagement.repository.TimeZoneMasterRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional(readOnly = true)
public class TimeZoneService {

    private final TimeZoneMasterRepository timeZoneMasterRepository;

    public TimeZoneService(TimeZoneMasterRepository timeZoneMasterRepository) {
        this.timeZoneMasterRepository = timeZoneMasterRepository;
    }

    public List<TimeZoneMasterDto> getAll() {
        return timeZoneMasterRepository.findAll().stream()
                .map(ExecutionEntityDtoMapper::toDto)
                .toList();
    }

    public List<TimeZoneMasterDto> searchByTimezoneName(String searchText) {
        if (searchText == null || searchText.trim().isEmpty()) {
            return getAll();
        }

        return timeZoneMasterRepository
                .findByTimezoneNameContainingIgnoreCaseOrderByTimezoneNameAsc(searchText.trim())
                .stream()
                .map(ExecutionEntityDtoMapper::toDto)
                .toList();
    }
}

package com.ubs.testmanagement.service;

import com.ubs.testmanagement.dto.ExecutionEntityDtoMapper;
import com.ubs.testmanagement.dto.FrequencyDto;
import com.ubs.testmanagement.repository.FrequencyRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional(readOnly = true)
public class FrequencyService {

    private final FrequencyRepository frequencyRepository;

    public FrequencyService(FrequencyRepository frequencyRepository) {
        this.frequencyRepository = frequencyRepository;
    }

    public List<FrequencyDto> getAll() {
        return frequencyRepository.findAll().stream()
                .map(ExecutionEntityDtoMapper::toDto)
                .toList();
    }

    public List<FrequencyDto> searchByFrequencyName(String searchText) {
        if (searchText == null || searchText.trim().isEmpty()) {
            return getAll();
        }

        return frequencyRepository
                .findByFrequencyNameContainingIgnoreCaseOrderByFrequencyNameAsc(searchText.trim())
                .stream()
                .map(ExecutionEntityDtoMapper::toDto)
                .toList();
    }
}

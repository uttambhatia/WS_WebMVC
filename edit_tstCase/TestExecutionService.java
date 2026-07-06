package com.ubs.testmanagement.service;

import com.ubs.testmanagement.dto.ExecutionEntityDtoMapper;
import com.ubs.testmanagement.dto.ExecutionItemDto;
import com.ubs.testmanagement.dto.PagedResponseDto;
import com.ubs.testmanagement.dto.TestExecutionDto;
import com.ubs.testmanagement.entity.ExecutionItem;
import com.ubs.testmanagement.entity.RunType;
import com.ubs.testmanagement.entity.Schedule;
import com.ubs.testmanagement.entity.TestExecution;
import com.ubs.testmanagement.repository.ExecutionItemRepository;
import com.ubs.testmanagement.repository.ScheduleRepository;
import com.ubs.testmanagement.repository.TestExecutionRepository;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
@Transactional(readOnly = true)
public class TestExecutionService {

    private static final List<String> ALLOWED_SORT_COLUMNS = List.of(
            "executionId", "testId", "runType", "status", "startedAt", "finishedAt", "createdAt",
            "passed", "failed", "error", "skipped", "total"
    );

    private final TestExecutionRepository testExecutionRepository;
    private final ExecutionItemRepository executionItemRepository;
    private final ScheduleRepository scheduleRepository;

    public TestExecutionService(
            TestExecutionRepository testExecutionRepository,
            ExecutionItemRepository executionItemRepository,
            ScheduleRepository scheduleRepository) {
        this.testExecutionRepository = testExecutionRepository;
        this.executionItemRepository = executionItemRepository;
        this.scheduleRepository = scheduleRepository;
    }

    @Transactional
    public TestExecutionDto create(TestExecutionDto request) {
        if (request == null) {
            throw new IllegalArgumentException("Request body is required");
        }
        if (request.getRunType() == null) {
            throw new IllegalArgumentException("runType is required");
        }
        if (request.getStatus() == null || request.getStatus().trim().isEmpty()) {
            throw new IllegalArgumentException("status is required");
        }

        TestExecution entity = new TestExecution();
        entity.setTestId(trimToNull(request.getTestId()));
        entity.setRunType(request.getRunType());
        entity.setStatus(request.getStatus().trim());
        entity.setErrorMessage(trimToNull(request.getErrorMessage()));
        entity.setStartedAt(request.getStartedAt());
        entity.setFinishedAt(request.getFinishedAt());
        entity.setPassed(defaultIfNull(request.getPassed()));
        entity.setFailed(defaultIfNull(request.getFailed()));
        entity.setError(defaultIfNull(request.getError()));
        entity.setSkipped(defaultIfNull(request.getSkipped()));
        entity.setTotal(defaultIfNull(request.getTotal()));

        if (request.getScheduleId() != null) {
            Schedule schedule = scheduleRepository.findById(request.getScheduleId())
                    .orElseThrow(() -> new IllegalArgumentException("Schedule not found for id: " + request.getScheduleId()));
            entity.setSchedule(schedule);
        }

        TestExecution saved = testExecutionRepository.save(entity);
        saveExecutionItems(saved, request.getExecutionItems());
        return ExecutionEntityDtoMapper.toDto(saved);
    }

    /**
     * Upsert by testId: if an execution with this testId already exists, update
     * the most-recent record in place. Prevents duplicate rows when the frontend
     * re-saves on status transitions (e.g. polling detects "completed" for an
     * execution the scheduler already persisted as "pending").
     */
    @Transactional
    public TestExecutionDto upsert(TestExecutionDto request) {
        if (request == null) {
            throw new IllegalArgumentException("Request body is required");
        }
        if (request.getStatus() == null || request.getStatus().trim().isEmpty()) {
            throw new IllegalArgumentException("status is required");
        }

        String testId = trimToNull(request.getTestId());
        if (testId != null) {
            List<TestExecution> existing = testExecutionRepository.findByTestId(testId);
            if (!existing.isEmpty()) {
                // Update the most-recent matching record instead of inserting a duplicate
                TestExecution entity = existing.stream()
                        .max(java.util.Comparator.comparingLong(
                                e -> e.getExecutionId() == null ? 0L : e.getExecutionId()))
                        .get();

                entity.setStatus(request.getStatus().trim());
                if (request.getStartedAt()    != null) entity.setStartedAt(request.getStartedAt());
                if (request.getFinishedAt()   != null) entity.setFinishedAt(request.getFinishedAt());
                if (request.getErrorMessage() != null) entity.setErrorMessage(trimToNull(request.getErrorMessage()));
                if (request.getPassed()       != null) entity.setPassed(request.getPassed());
                if (request.getFailed()       != null) entity.setFailed(request.getFailed());
                if (request.getError()        != null) entity.setError(request.getError());
                if (request.getSkipped()      != null) entity.setSkipped(request.getSkipped());
                if (request.getTotal()        != null) entity.setTotal(request.getTotal());
                if (request.getRunType()      != null) entity.setRunType(request.getRunType());

                TestExecution saved = testExecutionRepository.save(entity);
                
                // Update execution_items if provided (important for re-saving with results)
                if (request.getExecutionItems() != null && !request.getExecutionItems().isEmpty()) {
                    saveExecutionItems(saved, request.getExecutionItems());
                }
                
                return ExecutionEntityDtoMapper.toDto(saved);
            }
        }

        // No existing record with this testId – create fresh
        if (request.getRunType() == null) {
            request.setRunType(RunType.ADHOC);
        }
        return create(request);
    }

    /**
     * Fetch a single execution by ID with all details (items, schedule info).
     */
    public TestExecutionDto getById(Long executionId) {
        return testExecutionRepository.findById(executionId)
                .map(entity -> {
                    TestExecutionDto dto = ExecutionEntityDtoMapper.toDto(entity);
                    List<ExecutionItemDto> items = executionItemRepository
                            .findByExecutionExecutionIdOrderByScriptOrderAsc(entity.getExecutionId())
                            .stream()
                            .map(ExecutionEntityDtoMapper::toDto)
                            .toList();
                    dto.setExecutionItems(items);
                    if (entity.getSchedule() != null) {
                        dto.setScheduleId(entity.getSchedule().getScheduleId());
                    }
                    return dto;
                })
                .orElse(null);
    }

    public PagedResponseDto<TestExecutionDto> fetchAll(
            int page,
            int size,
            String sortBy,
            String sortDirection,
            Map<String, String> filters) {

        int safePage = Math.max(page, 0);
        int safeSize = Math.max(size, 1);
        String safeSortBy = normalizeSortBy(sortBy);
        Sort.Direction direction = "desc".equalsIgnoreCase(sortDirection) ? Sort.Direction.DESC : Sort.Direction.ASC;

        Pageable pageable = PageRequest.of(safePage, safeSize, Sort.by(direction, safeSortBy));
        Specification<TestExecution> specification = buildSpecification(filters);

        Page<TestExecution> resultPage = testExecutionRepository.findAll(specification, pageable);
        List<TestExecutionDto> content = resultPage.getContent().stream().map(execution -> {
            TestExecutionDto dto = ExecutionEntityDtoMapper.toDto(execution);
            List<ExecutionItemDto> items = executionItemRepository
                .findByExecutionExecutionIdOrderByScriptOrderAsc(execution.getExecutionId())
                .stream()
                .map(ExecutionEntityDtoMapper::toDto)
                .toList();
            dto.setExecutionItems(items);
            return dto;
        }).toList();

        return new PagedResponseDto<>(
                content,
                resultPage.getNumber(),
                resultPage.getSize(),
                resultPage.getTotalElements(),
                resultPage.getTotalPages());
    }

    private Specification<TestExecution> buildSpecification(Map<String, String> filters) {
        if (filters == null || filters.isEmpty()) {
            return Specification.where(null);
        }

        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            String testId = trimToNull(filters.get("testId"));
            if (testId != null) {
                predicates.add(cb.like(cb.lower(root.get("testId")), "%" + testId.toLowerCase() + "%"));
            }

            String status = trimToNull(filters.get("status"));
            if (status != null) {
                predicates.add(cb.equal(cb.lower(root.get("status")), status.toLowerCase()));
            }

            String runType = trimToNull(filters.get("runType"));
            if (runType != null) {
                try {
                    predicates.add(cb.equal(root.get("runType"), RunType.valueOf(runType.toUpperCase())));
                } catch (IllegalArgumentException ex) {
                    throw new IllegalArgumentException("Invalid runType filter: " + runType);
                }
            }

            String scheduleId = trimToNull(filters.get("scheduleId"));
            if (scheduleId != null) {
                try {
                    predicates.add(cb.equal(root.join("schedule").get("scheduleId"), Long.valueOf(scheduleId)));
                } catch (NumberFormatException ex) {
                    throw new IllegalArgumentException("Invalid scheduleId filter: " + scheduleId);
                }
            }

            String createdAtFrom = trimToNull(filters.get("createdAtFrom"));
            if (createdAtFrom != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), parseDateTime(createdAtFrom, "createdAtFrom")));
            }

            String createdAtTo = trimToNull(filters.get("createdAtTo"));
            if (createdAtTo != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("createdAt"), parseDateTime(createdAtTo, "createdAtTo")));
            }

            String startedAtFrom = trimToNull(filters.get("startedAtFrom"));
            if (startedAtFrom != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("startedAt"), parseDateTime(startedAtFrom, "startedAtFrom")));
            }

            String startedAtTo = trimToNull(filters.get("startedAtTo"));
            if (startedAtTo != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("startedAt"), parseDateTime(startedAtTo, "startedAtTo")));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    private LocalDateTime parseDateTime(String value, String fieldName) {
        try {
            return LocalDateTime.parse(value);
        } catch (DateTimeParseException exception) {
            throw new IllegalArgumentException("Invalid date-time for " + fieldName + ". Expected ISO_LOCAL_DATE_TIME format.");
        }
    }

    private String normalizeSortBy(String sortBy) {
        if (sortBy == null || sortBy.isBlank()) {
            return "executionId";
        }
        if (!ALLOWED_SORT_COLUMNS.contains(sortBy)) {
            throw new IllegalArgumentException("Unsupported sortBy column: " + sortBy);
        }
        return sortBy;
    }

    private Integer defaultIfNull(Integer value) {
        return value == null ? 0 : value;
    }

    private void saveExecutionItems(TestExecution execution, List<ExecutionItemDto> executionItems) {
        if (executionItems == null || executionItems.isEmpty()) {
            return;
        }

        // Fetch existing items for this execution to support upsert by script name
        List<ExecutionItem> existingItems = execution.getExecutionId() != null 
            ? executionItemRepository.findByExecutionExecutionIdOrderByScriptOrderAsc(execution.getExecutionId())
            : new ArrayList<>();

        List<ExecutionItem> itemsToSave = new ArrayList<>();
        
        for (ExecutionItemDto itemDto : executionItems) {
            if (itemDto == null) {
                continue;
            }

            String script = trimToNull(itemDto.getExecScript());
            
            // Try to find existing item by execution + script (natural key)
            ExecutionItem item = existingItems.stream()
                    .filter(e -> script != null && script.equals(e.getExecScript()))
                    .findFirst()
                    .orElse(null);

            if (item == null) {
                // Create new item if not found
                item = new ExecutionItem();
                item.setExecution(execution);
            }
            
            // Update fields (works for both new and existing items)
            item.setExecCaseId(trimToNull(itemDto.getExecCaseId()));
            item.setExecCaseName(trimToNull(itemDto.getExecCaseName()));
            item.setExecScript(script);
            item.setScriptOrder(itemDto.getScriptOrder());
            item.setStatus(trimToNull(itemDto.getStatus()));
            item.setError(trimToNull(itemDto.getError()));
            item.setDurationSeconds(itemDto.getDurationSeconds());

            if (itemDto.getScheduleId() != null) {
                Schedule itemSchedule = scheduleRepository.findById(itemDto.getScheduleId())
                        .orElseThrow(() -> new IllegalArgumentException("Schedule not found for id: " + itemDto.getScheduleId()));
                item.setSchedule(itemSchedule);
            } else {
                item.setSchedule(execution.getSchedule());
            }

            itemsToSave.add(item);
        }

        List<ExecutionItem> savedItems = executionItemRepository.saveAll(itemsToSave);
        execution.setExecutionItems(savedItems);
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}

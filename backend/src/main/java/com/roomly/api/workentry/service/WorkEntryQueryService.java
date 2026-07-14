package com.roomly.api.workentry.service;

import com.roomly.api.common.exception.NotFoundException;
import com.roomly.api.workentry.dto.WorkEntryResponse;
import com.roomly.api.workentry.entity.TimeEntryDetails;
import com.roomly.api.workentry.entity.UnitEntryItem;
import com.roomly.api.workentry.entity.WorkEntry;
import com.roomly.api.workentry.mapper.WorkEntryMapper;
import com.roomly.api.workentry.repository.TimeEntryDetailsRepository;
import com.roomly.api.workentry.repository.UnitEntryItemRepository;
import com.roomly.api.workentry.repository.WorkEntryRepository;
import com.roomly.api.worktype.entity.WorkType;
import com.roomly.api.worktype.repository.WorkTypeRepository;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class WorkEntryQueryService {
  private final WorkEntryRepository workEntries;
  private final TimeEntryDetailsRepository timeEntryDetails;
  private final UnitEntryItemRepository unitEntryItems;
  private final WorkTypeRepository workTypes;
  private final WorkEntryMapper mapper;

  @Transactional(readOnly = true)
  public Page<WorkEntryResponse> list(
      UUID userId, LocalDate fromDate, LocalDate toDate, UUID workTypeId, Pageable pageable) {
    Page<WorkEntry> page = findPage(userId, fromDate, toDate, workTypeId, pageable);
    return mapPage(page);
  }

  @Transactional(readOnly = true)
  public WorkEntryResponse getResponse(UUID userId, UUID id) {
    return toResponse(findEntry(userId, id));
  }

  @Transactional(readOnly = true)
  public List<WorkEntryResponse> listDay(UUID userId, LocalDate date) {
    return toResponses(workEntries.findAllByUserIdAndWorkDateOrderByCreatedAt(userId, date));
  }

  @Transactional(readOnly = true)
  public List<WorkEntryResponse> listRecent(UUID userId, int limit) {
    Pageable pageable =
        PageRequest.of(
            0,
            limit,
            Sort.by(Sort.Direction.DESC, "workDate")
                .and(Sort.by(Sort.Direction.DESC, "createdAt")));
    return toResponses(workEntries.findAllByUserId(userId, pageable).getContent());
  }

  @Transactional(readOnly = true)
  public WorkEntry findEntry(UUID userId, UUID id) {
    return workEntries.findByIdAndUserId(id, userId).orElseThrow(() -> new NotFoundException("WorkEntry", id));
  }

  @Transactional(readOnly = true)
  public WorkType findWorkType(UUID userId, UUID workTypeId) {
    return workTypes
        .findByIdAndUserId(workTypeId, userId)
        .orElseThrow(() -> new NotFoundException("WorkType", workTypeId));
  }

  @Transactional(readOnly = true)
  public List<WorkEntry> findEntriesInRange(UUID userId, LocalDate fromDate, LocalDate toDate) {
    return workEntries.findAllByUserIdAndWorkDateBetweenOrderByWorkDateAscCreatedAtAsc(userId, fromDate, toDate);
  }

  @Transactional(readOnly = true)
  public Page<WorkEntryResponse> mapPage(Page<WorkEntry> page) {
    Map<UUID, TimeEntryDetails> timeByEntryId = loadTimeDetails(page.getContent());
    Map<UUID, List<UnitEntryItem>> unitItemsByEntryId = loadUnitItems(page.getContent());
    return page.map(entry -> mapper.toResponse(entry, mapTime(timeByEntryId, entry), mapItems(unitItemsByEntryId, entry)));
  }

  @Transactional(readOnly = true)
  public WorkEntryResponse toResponse(WorkEntry entry) {
    Map<UUID, TimeEntryDetails> timeByEntryId = loadTimeDetails(List.of(entry));
    Map<UUID, List<UnitEntryItem>> unitItemsByEntryId = loadUnitItems(List.of(entry));
    return mapper.toResponse(entry, mapTime(timeByEntryId, entry), mapItems(unitItemsByEntryId, entry));
  }

  private List<WorkEntryResponse> toResponses(List<WorkEntry> entries) {
    Map<UUID, TimeEntryDetails> timeByEntryId = loadTimeDetails(entries);
    Map<UUID, List<UnitEntryItem>> unitItemsByEntryId = loadUnitItems(entries);
    return entries.stream()
        .map(entry -> mapper.toResponse(entry, mapTime(timeByEntryId, entry), mapItems(unitItemsByEntryId, entry)))
        .toList();
  }

  private Page<WorkEntry> findPage(
      UUID userId, LocalDate fromDate, LocalDate toDate, UUID workTypeId, Pageable pageable) {
    if (workTypeId == null && fromDate == null) {
      return workEntries.findAllByUserId(userId, pageable);
    }
    if (workTypeId == null) {
      return workEntries.findAllByUserIdAndWorkDateBetween(userId, fromDate, toDate, pageable);
    }
    if (fromDate == null) {
      return workEntries.findAllByUserIdAndWorkTypeId(userId, workTypeId, pageable);
    }
    return workEntries.findAllByUserIdAndWorkTypeIdAndWorkDateBetween(
        userId, workTypeId, fromDate, toDate, pageable);
  }

  private Map<UUID, TimeEntryDetails> loadTimeDetails(List<WorkEntry> entries) {
    if (entries.isEmpty()) {
      return Map.of();
    }
    List<UUID> entryIds = entries.stream().map(WorkEntry::getId).toList();
    Map<UUID, TimeEntryDetails> result = new LinkedHashMap<>();
    for (TimeEntryDetails detail : timeEntryDetails.findAllByWorkEntryIdIn(entryIds)) {
      result.put(detail.getWorkEntry().getId(), detail);
    }
    return result;
  }

  private Map<UUID, List<UnitEntryItem>> loadUnitItems(List<WorkEntry> entries) {
    if (entries.isEmpty()) {
      return Map.of();
    }
    List<UUID> entryIds = entries.stream().map(WorkEntry::getId).toList();
    Map<UUID, List<UnitEntryItem>> result = new LinkedHashMap<>();
    for (UnitEntryItem item : unitEntryItems.findAllByWorkEntryIdIn(entryIds)) {
      result.computeIfAbsent(item.getWorkEntry().getId(), ignored -> new ArrayList<>()).add(item);
    }
    return result;
  }

  private com.roomly.api.workentry.dto.TimeEntryDetailsResponse mapTime(
      Map<UUID, TimeEntryDetails> timeByEntryId, WorkEntry entry) {
    TimeEntryDetails detail = timeByEntryId.get(entry.getId());
    return detail == null ? null : mapper.toResponse(detail);
  }

  private List<com.roomly.api.workentry.dto.UnitEntryItemResponse> mapItems(
      Map<UUID, List<UnitEntryItem>> unitItemsByEntryId, WorkEntry entry) {
    return mapper.toUnitItemResponses(unitItemsByEntryId.getOrDefault(entry.getId(), List.of()));
  }
}

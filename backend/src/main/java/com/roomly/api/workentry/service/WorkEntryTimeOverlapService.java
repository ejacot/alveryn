package com.roomly.api.workentry.service;

import com.roomly.api.common.exception.ConflictException;
import com.roomly.api.imports.model.ExcelImportPreviewPayload;
import com.roomly.api.workentry.entity.TimeEntryDetails;
import com.roomly.api.workentry.repository.TimeEntryDetailsRepository;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class WorkEntryTimeOverlapService {
  public static final String ERROR_CODE = "WORK_ENTRY_TIME_OVERLAP";
  private static final DateTimeFormatter TIME_FORMAT = DateTimeFormatter.ofPattern("HH:mm");

  private final TimeEntryDetailsRepository timeEntryDetails;

  public void validateNoOverlap(
      UUID userId,
      UUID excludedEntryId,
      LocalDate workDate,
      LocalTime startTime,
      LocalTime endTime) {
    TimeInterval candidate = TimeInterval.of(null, null, workDate, startTime, endTime);
    findDatabaseConflict(userId, excludedEntryId, candidate)
        .ifPresent(
            conflict -> {
              throw new ConflictException(message(conflict), ERROR_CODE);
            });
  }

  public Optional<TimeInterval> findDatabaseConflict(
      UUID userId,
      UUID excludedEntryId,
      LocalDate workDate,
      LocalTime startTime,
      LocalTime endTime) {
    return findDatabaseConflict(userId, excludedEntryId, TimeInterval.of(null, null, workDate, startTime, endTime));
  }

  public Optional<TimeInterval> findDatabaseConflict(
      UUID userId, UUID excludedEntryId, TimeInterval candidate) {
    return timeEntryDetails.findAllForUserWithEntryAndWorkType(userId).stream()
        .filter(detail -> excludedEntryId == null || !detail.getWorkEntry().getId().equals(excludedEntryId))
        .map(this::toInterval)
        .filter(candidate::overlaps)
        .findFirst();
  }

  public Optional<WorkbookOverlap> findWorkbookConflict(
      List<ExcelImportPreviewPayload.WorkItemPlan> existingItems,
      LocalDate workDate,
      LocalTime startTime,
      LocalTime endTime) {
    TimeInterval candidate = TimeInterval.of(null, null, workDate, startTime, endTime);
    for (ExcelImportPreviewPayload.WorkItemPlan item : existingItems) {
      if (item.startTime() == null || item.endTime() == null) {
        continue;
      }
      TimeInterval existing =
          TimeInterval.of(item.sourceKey(), "Imported Shift", item.workDate(), item.startTime(), item.endTime());
      if (candidate.overlaps(existing)) {
        return Optional.of(new WorkbookOverlap(existing, item.sourceKey()));
      }
    }
    return Optional.empty();
  }

  public List<ExcelImportPreviewPayload.WorkItemPlan> newTimeItems(
      List<ExcelImportPreviewPayload.WorkItemPlan> plans) {
    List<ExcelImportPreviewPayload.WorkItemPlan> result = new ArrayList<>();
    for (ExcelImportPreviewPayload.WorkItemPlan plan : plans) {
      if (plan.disposition() == ExcelImportPreviewPayload.ItemDisposition.NEW
          && plan.startTime() != null
          && plan.endTime() != null) {
        result.add(plan);
      }
    }
    return result;
  }

  public String message(TimeInterval conflict) {
    return "This work entry overlaps an existing activity from %s to %s."
        .formatted(format(conflict.startTime()), format(conflict.endTime()));
  }

  public String previewMessage(TimeInterval conflict) {
    return "This imported work entry overlaps an existing activity from %s to %s."
        .formatted(format(conflict.startTime()), format(conflict.endTime()));
  }

  public String workbookPreviewMessage(TimeInterval conflict) {
    return "This imported work entry overlaps another row from %s to %s."
        .formatted(format(conflict.startTime()), format(conflict.endTime()));
  }

  private TimeInterval toInterval(TimeEntryDetails detail) {
    return TimeInterval.of(
        detail.getWorkEntry().getId(),
        detail.getWorkEntry().getWorkTypeNameSnapshot(),
        detail.getWorkEntry().getWorkDate(),
        detail.getStartTime(),
        detail.getEndTime());
  }

  private static String format(LocalTime value) {
    return value.format(TIME_FORMAT);
  }

  public record WorkbookOverlap(TimeInterval interval, String sourceKey) {}

  public record TimeInterval(
      Object entryId,
      String workTypeName,
      LocalDate workDate,
      LocalTime startTime,
      LocalTime endTime,
      LocalDateTime start,
      LocalDateTime end) {
    public static TimeInterval of(
        Object entryId, String workTypeName, LocalDate workDate, LocalTime startTime, LocalTime endTime) {
      LocalDateTime start = workDate.atTime(startTime);
      LocalDate endDate = endTime.isAfter(startTime) ? workDate : workDate.plusDays(1);
      return new TimeInterval(entryId, workTypeName, workDate, startTime, endTime, start, endDate.atTime(endTime));
    }

    public boolean overlaps(TimeInterval other) {
      return start.isBefore(other.end) && end.isAfter(other.start);
    }
  }
}

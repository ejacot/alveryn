package com.roomly.api.dashboard.service;

import com.roomly.api.absence.entity.Absence;
import com.roomly.api.absence.repository.AbsenceRepository;
import com.roomly.api.auth.security.AuthenticatedUserAccessor;
import com.roomly.api.dashboard.dto.DashboardResponse;
import com.roomly.api.workentry.entity.WorkEntry;
import com.roomly.api.workentry.service.WorkEntryQueryService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class DashboardService {
  private final AuthenticatedUserAccessor authenticatedUserAccessor;
  private final WorkEntryQueryService workEntryQueryService;
  private final AbsenceRepository absences;
  private final Clock clock;

  @Transactional(readOnly = true)
  public DashboardResponse getCurrentMonthDashboard() {
    YearMonth currentMonth = YearMonth.now(clock);
    LocalDate fromDate = currentMonth.atDay(1);
    LocalDate toDate = currentMonth.atEndOfMonth();
    var userId = authenticatedUserAccessor.requireUserId();

    List<WorkEntry> entries = workEntryQueryService.findEntriesInRange(userId, fromDate, toDate);
    BigDecimal workedMinutes =
        entries.stream()
            .map(WorkEntry::getCalculatedMinutes)
            .reduce(BigDecimal.ZERO.setScale(WorkEntry.TIME_SCALE), BigDecimal::add);
    BigDecimal grossAmount =
        entries.stream()
            .map(WorkEntry::getGrossAmount)
            .reduce(BigDecimal.ZERO.setScale(WorkEntry.GROSS_SCALE), BigDecimal::add);
    BigDecimal workedHours =
        workedMinutes.divide(BigDecimal.valueOf(60), WorkEntry.TIME_SCALE, RoundingMode.HALF_UP);

    long absenceDays =
        absences.findAllByUserIdAndStartDateLessThanEqualAndEndDateGreaterThanEqual(userId, toDate, fromDate)
            .stream()
            .mapToLong(absence -> overlappingDays(absence, fromDate, toDate))
            .sum();

    return new DashboardResponse(
        currentMonth, workedHours, workedMinutes, grossAmount, entries.size(), absenceDays);
  }

  private long overlappingDays(Absence absence, LocalDate fromDate, LocalDate toDate) {
    LocalDate overlapStart = absence.getStartDate().isAfter(fromDate) ? absence.getStartDate() : fromDate;
    LocalDate overlapEnd = absence.getEndDate().isBefore(toDate) ? absence.getEndDate() : toDate;
    return ChronoUnit.DAYS.between(overlapStart, overlapEnd) + 1;
  }
}

package com.alveryn.api.dashboard.service;

import com.alveryn.api.absence.entity.Absence;
import com.alveryn.api.absence.repository.AbsenceRepository;
import com.alveryn.api.auth.security.AuthenticatedUserAccessor;
import com.alveryn.api.dashboard.dto.DashboardResponse;
import com.alveryn.api.workrecord.calculation.WorkCalculation;
import com.alveryn.api.workrecord.entity.WorkRecord;
import com.alveryn.api.workrecord.line.entity.WorkRecordLine;
import com.alveryn.api.workrecord.line.repository.WorkRecordLineRepository;
import com.alveryn.api.workrecord.repository.WorkRecordRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class DashboardService {
  private final AuthenticatedUserAccessor authenticatedUserAccessor;
  private final WorkRecordRepository workRecordRepository;
  private final WorkRecordLineRepository workRecordLineRepository;
  private final AbsenceRepository absences;
  private final Clock clock;

  @Transactional(readOnly = true)
  public DashboardResponse getCurrentMonthDashboard() {
    YearMonth currentMonth = YearMonth.now(clock);
    LocalDate fromDate = currentMonth.atDay(1);
    LocalDate toDate = currentMonth.atEndOfMonth();
    var userId = authenticatedUserAccessor.requireUserId();

    List<WorkRecord> records =
        workRecordRepository.findAllOverlappingRange(
            userId, fromDate, toDate);
    Set<UUID> recordIds = records.stream().map(WorkRecord::getId).collect(Collectors.toSet());
    List<WorkRecordLine> recordLines =
        recordIds.isEmpty() ? List.of() : workRecordLineRepository.findAllByWorkRecordIdIn(recordIds);
    BigDecimal workedMinutes =
        recordLines.stream()
            .map(WorkRecordLine::getCalculatedMinutes)
            .reduce(BigDecimal.ZERO.setScale(WorkCalculation.TIME_SCALE), BigDecimal::add);
    BigDecimal grossAmount =
        recordLines.stream()
            .map(WorkRecordLine::getGrossAmount)
            .reduce(BigDecimal.ZERO.setScale(WorkCalculation.GROSS_SCALE), BigDecimal::add);
    BigDecimal workedHours =
        workedMinutes.divide(BigDecimal.valueOf(60), WorkCalculation.TIME_SCALE, RoundingMode.HALF_UP);

    long absenceDays =
        absences.findAllByUserIdAndStartDateLessThanEqualAndEndDateGreaterThanEqual(userId, toDate, fromDate)
            .stream()
            .mapToLong(absence -> overlappingDays(absence, fromDate, toDate))
            .sum();

    return new DashboardResponse(
        currentMonth, workedHours, workedMinutes, grossAmount, records.size(), absenceDays);
  }

  private long overlappingDays(Absence absence, LocalDate fromDate, LocalDate toDate) {
    LocalDate overlapStart = absence.getStartDate().isAfter(fromDate) ? absence.getStartDate() : fromDate;
    LocalDate overlapEnd = absence.getEndDate().isBefore(toDate) ? absence.getEndDate() : toDate;
    return ChronoUnit.DAYS.between(overlapStart, overlapEnd) + 1;
  }
}

package com.alveryn.api.restday.service;

import com.alveryn.api.absence.repository.AbsenceRepository;
import com.alveryn.api.employment.entity.Employment;
import com.alveryn.api.employment.service.EmploymentService;
import com.alveryn.api.restday.dto.RestDayRequest;
import com.alveryn.api.restday.dto.RestDayResponse;
import com.alveryn.api.restday.entity.EmploymentRestDay;
import com.alveryn.api.restday.repository.EmploymentRestDayRepository;
import com.alveryn.api.workrecord.repository.WorkRecordRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class EmploymentRestDayService {
  private final EmploymentService employments;
  private final EmploymentRestDayRepository restDays;
  private final WorkRecordRepository workRecords;
  private final AbsenceRepository absences;

  @Transactional(readOnly = true)
  public List<RestDayResponse> range(UUID employmentId, LocalDate from, LocalDate to) {
    employments.requireOwned(employmentId);
    if (to.isBefore(from)) {
      throw new IllegalArgumentException("to must be on or after from");
    }
    return restDays.findAllByEmploymentIdAndDateBetweenOrderByDate(employmentId, from, to)
        .stream()
        .map(this::response)
        .toList();
  }

  @Transactional
  public RestDayResponse mark(UUID employmentId, LocalDate date, RestDayRequest request) {
    Employment employment = employments.requireOwned(employmentId);
    UUID userId = employment.getUser().getId();
    if (workRecords.existsByUserIdAndEmploymentIdAndWorkDateBetween(
        userId, employmentId, date, date)) {
      throw new IllegalArgumentException("a day with recorded work cannot be marked as rest");
    }
    if (absences.existsByUserIdAndEmploymentIdAndStartDateLessThanEqualAndEndDateGreaterThanEqual(
        userId, employmentId, date, date)) {
      throw new IllegalArgumentException("a day with an absence cannot be marked as rest");
    }
    EmploymentRestDay restDay = restDays.findByEmploymentIdAndDate(employmentId, date)
        .orElseGet(() -> new EmploymentRestDay(
            employment.getUser(), employment, date, request.notes()));
    restDay.updateNotes(request.notes());
    return response(restDays.save(restDay));
  }

  @Transactional
  public void remove(UUID employmentId, LocalDate date) {
    employments.requireOwned(employmentId);
    restDays.findByEmploymentIdAndDate(employmentId, date).ifPresent(restDays::delete);
  }

  private RestDayResponse response(EmploymentRestDay value) {
    return new RestDayResponse(
        value.getId(),
        value.getEmployment().getId(),
        value.getDate(),
        value.getSource(),
        value.getNotes());
  }
}

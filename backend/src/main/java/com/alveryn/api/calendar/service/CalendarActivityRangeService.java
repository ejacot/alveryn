package com.alveryn.api.calendar.service;

import com.alveryn.api.absence.repository.AbsenceRepository;
import com.alveryn.api.auth.security.AuthenticatedUserAccessor;
import com.alveryn.api.calendar.dto.CalendarActivityRangeResponse;
import com.alveryn.api.workentry.repository.WorkEntryRepository;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CalendarActivityRangeService {
  private final AuthenticatedUserAccessor authenticatedUserAccessor;
  private final WorkEntryRepository workEntries;
  private final AbsenceRepository absences;

  @Transactional(readOnly = true)
  public CalendarActivityRangeResponse getRange() {
    var userId = authenticatedUserAccessor.requireUserId();
    LocalDate firstWorkDate = workEntries.findEarliestWorkDateByUserId(userId);
    LocalDate firstAbsenceDate = absences.findEarliestStartDateByUserId(userId);
    return new CalendarActivityRangeResponse(earliest(firstWorkDate, firstAbsenceDate));
  }

  private LocalDate earliest(LocalDate first, LocalDate second) {
    if (first == null) {
      return second;
    }
    if (second == null) {
      return first;
    }
    return first.isBefore(second) ? first : second;
  }
}

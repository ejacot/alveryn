package com.roomly.api.workentry.service;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.roomly.api.absence.repository.AbsenceRepository;
import com.roomly.api.common.exception.ValidationException;
import com.roomly.api.workentry.dto.WorkEntryRequest;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class WorkEntryValidationServiceTest {
  private final AbsenceRepository absences = mock(AbsenceRepository.class);
  private final WorkEntryValidationService service = new WorkEntryValidationService(absences);

  @Test
  void rejectsMonthWithoutYear() {
    assertThatThrownBy(() -> service.resolveRange(null, 7))
        .isInstanceOf(ValidationException.class)
        .hasMessage("year is required when month is provided");
  }

  @Test
  void rejectsDuplicateUnitTypes() {
    UUID unitTypeId = UUID.randomUUID();

    assertThatThrownBy(() -> service.validateUniqueUnitTypes(List.of(unitTypeId, unitTypeId)))
        .isInstanceOf(ValidationException.class)
        .hasMessage("Each unit type can appear only once in a work entry");
  }

  @Test
  void rejectsAbsenceConflict() {
    UUID userId = UUID.randomUUID();
    when(absences.existsByUserIdAndStartDateLessThanEqualAndEndDateGreaterThanEqual(
            userId, LocalDate.of(2026, 7, 12), LocalDate.of(2026, 7, 12)))
        .thenReturn(true);

    WorkEntryRequest request =
        new WorkEntryRequest(
            UUID.randomUUID(), LocalDate.of(2026, 7, 12), null, null, null, List.of(), null);

    assertThatThrownBy(
            () ->
                service.validateForPersistence(
                    userId,
                    new com.roomly.api.worktype.entity.WorkType(
                        new com.roomly.api.user.entity.UserAccount("test@example.com", "hash"),
                        "Rooms",
                        com.roomly.api.worktype.entity.CalculationMethod.TIME_BASED),
                    request))
        .hasMessage("A work entry cannot exist on a day with an absence");
  }
}

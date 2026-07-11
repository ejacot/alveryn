package com.roomly.api.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.roomly.api.absence.entity.Absence;
import com.roomly.api.absence.entity.AbsenceType;
import com.roomly.api.absence.repository.AbsenceRepository;
import com.roomly.api.salary.entity.HourlyRatePeriod;
import com.roomly.api.salary.repository.HourlyRatePeriodRepository;
import com.roomly.api.user.entity.UserAccount;
import com.roomly.api.user.repository.UserAccountRepository;
import com.roomly.api.worktype.entity.CalculationMethod;
import com.roomly.api.worktype.entity.UnitType;
import com.roomly.api.worktype.entity.WorkType;
import com.roomly.api.worktype.repository.UnitTypeRepository;
import com.roomly.api.worktype.repository.WorkTypeRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Transactional
class RepositoryDomainTest {
  @Autowired UserAccountRepository users;
  @Autowired WorkTypeRepository workTypes;
  @Autowired UnitTypeRepository unitTypes;
  @Autowired HourlyRatePeriodRepository rates;
  @Autowired AbsenceRepository absences;

  @Test
  void workTypeNameIsUniquePerUserButReusableByAnotherUser() {
    var first = users.save(new UserAccount("first@example.com", "hash"));
    var second = users.save(new UserAccount("second@example.com", "hash"));
    workTypes.saveAndFlush(new WorkType(first, "Checker", CalculationMethod.TIME_BASED));
    workTypes.saveAndFlush(new WorkType(second, "checker", CalculationMethod.TIME_BASED));
    assertThatThrownBy(
            () ->
                workTypes.saveAndFlush(
                    new WorkType(first, "CHECKER", CalculationMethod.TIME_BASED)))
        .isInstanceOf(DataIntegrityViolationException.class);
  }

  @Test
  void unitTypeNameIsUniqueWithinWorkType() {
    var user = users.save(new UserAccount("units@example.com", "hash"));
    var type = workTypes.save(new WorkType(user, "Rooms", CalculationMethod.UNIT_BASED));
    unitTypes.saveAndFlush(new UnitType(type, "Normal", new BigDecimal("2.4")));
    assertThatThrownBy(() -> unitTypes.saveAndFlush(new UnitType(type, "NORMAL", BigDecimal.ONE)))
        .isInstanceOf(DataIntegrityViolationException.class);
  }

  @Test
  void findsValidRateAndDetectsClosedIntervalOverlap() {
    var user = users.save(new UserAccount("rate@example.com", "hash"));
    rates.saveAndFlush(
        new HourlyRatePeriod(
            user, BigDecimal.TEN, "EUR", LocalDate.of(2025, 1, 1), LocalDate.of(2025, 1, 31)));
    assertThat(rates.findValidForDate(user.getId(), LocalDate.of(2025, 1, 31))).isPresent();
    assertThat(
            rates.existsOverlappingClosed(
                user.getId(), LocalDate.of(2025, 1, 31), LocalDate.of(2025, 2, 2)))
        .isTrue();
    assertThat(
            rates.existsOverlappingClosed(
                user.getId(), LocalDate.of(2025, 2, 1), LocalDate.of(2025, 2, 28)))
        .isFalse();
  }

  @Test
  void detectsOverlapWithOpenEndedPeriodsInBothDirections() {
    var user = users.save(new UserAccount("open-rate@example.com", "hash"));
    rates.saveAndFlush(
        new HourlyRatePeriod(user, BigDecimal.TEN, "EUR", LocalDate.of(2025, 5, 1), null));
    assertThat(rates.existsOverlappingOpenEnded(user.getId(), LocalDate.of(2025, 6, 1))).isTrue();
    assertThat(rates.existsOverlappingOpenEnded(user.getId(), LocalDate.of(2024, 1, 1))).isTrue();
    assertThat(
            rates.existsOverlappingClosed(
                user.getId(), LocalDate.of(2024, 1, 1), LocalDate.of(2025, 4, 30)))
        .isFalse();
  }

  @Test
  void absenceQueryReturnsRowsWhoseInclusiveRangesOverlap() {
    var user = users.save(new UserAccount("absence@example.com", "hash"));
    absences.saveAndFlush(
        new Absence(
            user, AbsenceType.VACATION, LocalDate.of(2025, 7, 10), LocalDate.of(2025, 7, 15)));
    assertThat(
            absences.findAllByUserIdAndStartDateLessThanEqualAndEndDateGreaterThanEqual(
                user.getId(), LocalDate.of(2025, 7, 12), LocalDate.of(2025, 7, 12)))
        .hasSize(1);
    assertThat(
            absences.findAllByUserIdAndStartDateLessThanEqualAndEndDateGreaterThanEqual(
                user.getId(), LocalDate.of(2025, 7, 9), LocalDate.of(2025, 7, 1)))
        .isEmpty();
  }
}

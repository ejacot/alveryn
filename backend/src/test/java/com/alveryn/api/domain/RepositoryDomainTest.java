package com.alveryn.api.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.alveryn.api.absence.entity.Absence;
import com.alveryn.api.absence.entity.AbsenceType;
import com.alveryn.api.absence.repository.AbsenceRepository;
import com.alveryn.api.salary.entity.HourlyRatePeriod;
import com.alveryn.api.salary.repository.HourlyRatePeriodRepository;
import com.alveryn.api.employment.entity.CompensationType;
import com.alveryn.api.employment.entity.Employment;
import com.alveryn.api.employment.repository.EmploymentRepository;
import com.alveryn.api.user.entity.EmploymentType;
import com.alveryn.api.user.entity.UserAccount;
import com.alveryn.api.user.repository.UserAccountRepository;
import com.alveryn.api.worktype.entity.CalculationMethod;
import com.alveryn.api.worktype.entity.WorkType;
import com.alveryn.api.worktype.repository.WorkTypeRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
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
  @Autowired HourlyRatePeriodRepository rates;
  @Autowired EmploymentRepository employments;
  @Autowired AbsenceRepository absences;

  @Test
  void workTypeNameIsUniquePerUserButReusableByAnotherUser() {
    var first = users.save(new UserAccount("first-" + UUID.randomUUID() + "@example.com", "hash"));
    var second = users.save(new UserAccount("second-" + UUID.randomUUID() + "@example.com", "hash"));
    workTypes.saveAndFlush(new WorkType(first, "Checker", CalculationMethod.TIME_BASED));
    workTypes.saveAndFlush(new WorkType(second, "checker", CalculationMethod.TIME_BASED));
    assertThatThrownBy(
            () ->
                workTypes.saveAndFlush(
                    new WorkType(first, "CHECKER", CalculationMethod.TIME_BASED)))
        .isInstanceOf(DataIntegrityViolationException.class);
  }

  @Test
  void findsValidRateAndDetectsClosedIntervalOverlap() {
    var user = users.save(new UserAccount("rate-" + UUID.randomUUID() + "@example.com", "hash"));
    var employment = employment(user, "Main job");
    rates.saveAndFlush(
        new HourlyRatePeriod(
            user, employment, BigDecimal.TEN, "EUR", LocalDate.of(2025, 1, 1), LocalDate.of(2025, 1, 31)));
    assertThat(rates.findValidForDate(user.getId(), employment.getId(), LocalDate.of(2025, 1, 31))).isPresent();
    assertThat(
            rates.existsOverlappingClosed(
                user.getId(), employment.getId(), LocalDate.of(2025, 1, 31), LocalDate.of(2025, 2, 2)))
        .isTrue();
    assertThat(
            rates.existsOverlappingClosed(
                user.getId(), employment.getId(), LocalDate.of(2025, 2, 1), LocalDate.of(2025, 2, 28)))
        .isFalse();
  }

  @Test
  void detectsOverlapWithOpenEndedPeriodsInBothDirections() {
    var user = users.save(new UserAccount("open-rate-" + UUID.randomUUID() + "@example.com", "hash"));
    var employment = employment(user, "Main job");
    rates.saveAndFlush(
        new HourlyRatePeriod(user, employment, BigDecimal.TEN, "EUR", LocalDate.of(2025, 5, 1), null));
    assertThat(rates.existsOverlappingOpenEnded(user.getId(), employment.getId(), LocalDate.of(2025, 6, 1))).isTrue();
    assertThat(rates.existsOverlappingOpenEnded(user.getId(), employment.getId(), LocalDate.of(2024, 1, 1))).isTrue();
    assertThat(
            rates.existsOverlappingClosed(
                user.getId(), employment.getId(), LocalDate.of(2024, 1, 1), LocalDate.of(2025, 4, 30)))
        .isFalse();
  }

  private Employment employment(UserAccount user, String name) {
    var employment = new Employment(user, name);
    employment.configure(
        EmploymentType.FULL_TIME, CompensationType.HOURLY, LocalDate.of(2025, 1, 1), null,
        null, "EUR", null, null, true, 0);
    return employments.saveAndFlush(employment);
  }

  @Test
  void absenceQueryReturnsRowsWhoseInclusiveRangesOverlap() {
    var user = users.save(new UserAccount("absence-" + UUID.randomUUID() + "@example.com", "hash"));
    absences.saveAndFlush(
        new Absence(
            user, employment(user, "Main job"), AbsenceType.VACATION, LocalDate.of(2025, 7, 10), LocalDate.of(2025, 7, 15)));
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

package com.alveryn.api.application;

import static org.assertj.core.api.Assertions.*;

import com.alveryn.api.auth.security.AuthenticatedUser;
import com.alveryn.api.common.exception.ConflictException;
import com.alveryn.api.salary.dto.HourlyRatePeriodRequest;
import com.alveryn.api.salary.service.HourlyRatePeriodService;
import com.alveryn.api.salary.service.SalaryCalculationService;
import com.alveryn.api.employment.entity.CompensationType;
import com.alveryn.api.employment.entity.Employment;
import com.alveryn.api.employment.repository.EmploymentRepository;
import com.alveryn.api.user.dto.*;
import com.alveryn.api.user.entity.*;
import com.alveryn.api.user.repository.UserAccountRepository;
import com.alveryn.api.user.service.*;
import com.alveryn.api.worktype.dto.*;
import com.alveryn.api.worktype.entity.CalculationMethod;
import com.alveryn.api.worktype.entity.CompensationMethod;
import com.alveryn.api.worktype.service.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Transactional
class ApplicationServiceTest {
  @Autowired UserAccountRepository users;
  @Autowired WorkTypeService workTypes;
  @Autowired HourlyRatePeriodService rates;
  @Autowired SalaryCalculationService salaryCalculations;
  @Autowired EmploymentRepository employments;
  @Autowired UserProfileService profiles;
  @Autowired UserPreferencesService preferences;
  private UUID userId;
  private UUID employmentId;

  @BeforeEach
  void setUp() {
    UserAccount user = users.save(new UserAccount("services-" + UUID.randomUUID() + "@example.com", "hash"));
    userId = user.getId();
    var employment = new Employment(user, "Main job");
    employment.configure(
        EmploymentType.FULL_TIME, CompensationType.HOURLY, LocalDate.of(2025, 1, 1), null,
        null, "EUR", null, null, true, 0);
    employmentId = employments.saveAndFlush(employment).getId();
    SecurityContextHolder.getContext()
        .setAuthentication(
            new UsernamePasswordAuthenticationToken(
                new AuthenticatedUser(userId, user.getEmail(), false, user.getStatus(), user.getRole()),
                null));
  }

  @AfterEach
  void tearDown() {
    SecurityContextHolder.clearContext();
  }

  @Test
  void managesParentAndChildWorkTypesWithinOwnership() {
    var work =
        workTypes.create(
            new CreateWorkTypeRequest(
                "Rooms",
                null,
                CalculationMethod.UNIT_BASED,
                CompensationMethod.PER_UNIT,
                null,
                null,
                null,
                null,
                null,
                false,
                true,
                "#87C95A",
                null,
                null,
                0));
    assertThat(workTypes.list()).hasSize(1);
    var formula =
        workTypes.create(
            new CreateWorkTypeRequest(
                "Normal",
                work.id(),
                CalculationMethod.UNITS_PER_HOUR_BASED,
                CompensationMethod.HOURLY,
                "Room",
                null,
                new BigDecimal("2.4"),
                null,
                null,
                false,
                false,
                "#60A5FA",
                null,
                null,
                0));
    assertThat(workTypes.get(formula.id()).name()).isEqualTo("Normal");
    workTypes.delete(formula.id());
    assertThat(workTypes.list()).filteredOn(item -> item.id().equals(formula.id())).allMatch(item -> !item.active());
    workTypes.delete(work.id());
    assertThat(workTypes.list()).filteredOn(item -> item.id().equals(work.id())).allMatch(workType -> !workType.active());
  }

  @Test
  void createsWorkTypesFromMinimalPayloadWithBackendDefaults() {
    var timeBased =
        workTypes.create(
            new CreateWorkTypeRequest("Check", CalculationMethod.TIME_BASED, null, null, null, null));
    var unitBased =
        workTypes.create(
            new CreateWorkTypeRequest(
                "Rooms",
                null,
                CalculationMethod.UNIT_BASED,
                CompensationMethod.PER_UNIT,
                null,
                null,
                null,
                null,
                null,
                false,
                true,
                null,
                null,
                null,
                null));

    assertThat(timeBased.name()).isEqualTo("Check");
    assertThat(timeBased.color()).matches("#[0-9A-F]{6}");
    assertThat(timeBased.defaultBreakMinutes()).isEqualTo(30);
    assertThat(timeBased.displayOrder()).isGreaterThanOrEqualTo(0);
    assertThat(unitBased.name()).isEqualTo("Rooms");
    assertThat(unitBased.color()).matches("#[0-9A-F]{6}");
    assertThat(unitBased.defaultBreakMinutes()).isNull();
    assertThat(unitBased.displayOrder()).isGreaterThan(timeBased.displayOrder());
    assertThat(workTypes.list()).extracting(WorkTypeResponse::id).contains(timeBased.id(), unitBased.id());
  }

  @Test
  void workTypeUpdatePreservesCalculationMethod() {
    var created =
        workTypes.create(
            new CreateWorkTypeRequest(
                "Units",
                null,
                CalculationMethod.UNIT_BASED,
                CompensationMethod.PER_UNIT,
                null,
                null,
                null,
                null,
                null,
                false,
                true,
                "#87C95A",
                null,
                null,
                0));
    var updated =
        workTypes.update(
            created.id(),
            new UpdateWorkTypeRequest(
                "Renamed",
                null,
                CalculationMethod.UNIT_BASED,
                CompensationMethod.PER_UNIT,
                null,
                null,
                null,
                null,
                null,
                false,
                true,
                "#AABBCC",
                "icon",
                null,
                3,
                true));
    assertThat(updated.calculationMethod()).isEqualTo(CalculationMethod.UNIT_BASED);
    assertThat(updated.name()).isEqualTo("Renamed");
    assertThat(updated.color()).isEqualTo("#AABBCC");
  }

  @Test
  void salaryServiceRejectsOverlappingPeriods() {
    rates.create(
        new HourlyRatePeriodRequest(
            employmentId, new BigDecimal("15.50"), "EUR", LocalDate.of(2025, 1, 1), LocalDate.of(2025, 1, 31)));
    assertThatThrownBy(
            () ->
                rates.create(
                    new HourlyRatePeriodRequest(
                        employmentId, new BigDecimal("17.50"), "EUR", LocalDate.of(2025, 1, 31), null)))
        .isInstanceOf(ConflictException.class);
    assertThat(rates.list()).hasSize(1);
  }

  @Test
  void hourlyRatesAndCalculationsAreIsolatedPerEmployment() {
    UserAccount user = users.findById(userId).orElseThrow();
    var minijob = new Employment(user, "Minijob");
    minijob.configure(
        EmploymentType.MINI_JOB, CompensationType.HOURLY, LocalDate.of(2025, 1, 1), null,
        null, "EUR", null, null, true, 1);
    UUID minijobId = employments.saveAndFlush(minijob).getId();

    rates.create(new HourlyRatePeriodRequest(
        employmentId, new BigDecimal("20.00"), "EUR", LocalDate.of(2025, 1, 1), null));
    rates.create(new HourlyRatePeriodRequest(
        minijobId, new BigDecimal("15.00"), "EUR", LocalDate.of(2025, 1, 1), null));

    assertThat(salaryCalculations.calculateForDate(
            userId, employmentId, LocalDate.of(2025, 6, 1), new BigDecimal("120")).grossAmount())
        .isEqualByComparingTo("40.00");
    assertThat(salaryCalculations.calculateForDate(
            userId, minijobId, LocalDate.of(2025, 6, 1), new BigDecimal("120")).grossAmount())
        .isEqualByComparingTo("30.00");
  }

  @Test
  void createsAndUpdatesProfileAndPreferences() {
    var profile =
        profiles.update(
            new UserProfileRequest(
                "Ana", "Pop", "Ana", null, null, "RO", null, null, null, null, null, null, null, null,
                null, null));
    assertThat(profile.firstName()).isEqualTo("Ana");
    var prefs =
        preferences.update(
            new UserPreferencesRequest(
                "ro",
                "Europe/Berlin",
                "EUR",
                FirstDayOfWeek.MONDAY,
                "DD.MM.YYYY",
                TimeFormat.H24,
                ThemePreference.SYSTEM,
                30,
                480,
                true,
                true));
    assertThat(prefs.onboardingCompleted()).isFalse();
    assertThat(preferences.completeOnboarding().isOnboardingCompleted()).isTrue();
    assertThat(preferences.get().preferredDailyMinutes()).isEqualTo(480);
  }
}

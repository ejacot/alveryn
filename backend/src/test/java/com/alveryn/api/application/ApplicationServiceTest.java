package com.alveryn.api.application;

import static org.assertj.core.api.Assertions.*;

import com.alveryn.api.auth.security.AuthenticatedUser;
import com.alveryn.api.common.exception.ConflictException;
import com.alveryn.api.salary.dto.HourlyRatePeriodRequest;
import com.alveryn.api.salary.service.HourlyRatePeriodService;
import com.alveryn.api.user.dto.*;
import com.alveryn.api.user.entity.*;
import com.alveryn.api.user.repository.UserAccountRepository;
import com.alveryn.api.user.service.*;
import com.alveryn.api.worktype.dto.*;
import com.alveryn.api.worktype.entity.CalculationMethod;
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
  @Autowired UnitTypeService unitTypes;
  @Autowired HourlyRatePeriodService rates;
  @Autowired UserProfileService profiles;
  @Autowired UserPreferencesService preferences;
  private UUID userId;

  @BeforeEach
  void setUp() {
    UserAccount user = users.save(new UserAccount("services-" + UUID.randomUUID() + "@example.com", "hash"));
    userId = user.getId();
    SecurityContextHolder.getContext()
        .setAuthentication(
            new UsernamePasswordAuthenticationToken(
                new AuthenticatedUser(userId, user.getEmail(), false, user.getStatus()),
                null));
  }

  @AfterEach
  void tearDown() {
    SecurityContextHolder.clearContext();
  }

  @Test
  void managesWorkAndUnitTypesWithinOwnership() {
    var work =
        workTypes.create(
            new CreateWorkTypeRequest(
                "Rooms", CalculationMethod.UNIT_BASED, "#87C95A", null, 0, 0));
    assertThat(workTypes.list()).hasSize(1);
    var unit =
        unitTypes.create(
            work.id(), new UnitTypeRequest("Normal", new BigDecimal("2.4"), 0, true));
    assertThat(unitTypes.get(work.id(), unit.id()).name()).isEqualTo("Normal");
    unitTypes.delete(work.id(), unit.id());
    assertThat(unitTypes.list(work.id())).allMatch(unitType -> !unitType.active());
    workTypes.delete(work.id());
    assertThat(workTypes.list()).allMatch(workType -> !workType.active());
  }

  @Test
  void createsWorkTypesFromMinimalPayloadWithBackendDefaults() {
    var timeBased =
        workTypes.create(
            new CreateWorkTypeRequest("Check", CalculationMethod.TIME_BASED, null, null, null, null));
    var unitBased =
        workTypes.create(
            new CreateWorkTypeRequest("Rooms", CalculationMethod.UNIT_BASED, null, null, null, null));

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
                "Units", CalculationMethod.UNIT_BASED, "#87C95A", null, 0, 0));
    var updated =
        workTypes.update(
            created.id(),
            new UpdateWorkTypeRequest(
                "Renamed", CalculationMethod.UNIT_BASED, "#AABBCC", "icon", 15, 3, true));
    assertThat(updated.calculationMethod()).isEqualTo(CalculationMethod.UNIT_BASED);
    assertThat(updated.name()).isEqualTo("Renamed");
    assertThat(updated.color()).isEqualTo("#AABBCC");
  }

  @Test
  void salaryServiceRejectsOverlappingPeriods() {
    rates.create(
        new HourlyRatePeriodRequest(
            new BigDecimal("15.50"), "EUR", LocalDate.of(2025, 1, 1), LocalDate.of(2025, 1, 31)));
    assertThatThrownBy(
            () ->
                rates.create(
                    new HourlyRatePeriodRequest(
                        new BigDecimal("17.50"), "EUR", LocalDate.of(2025, 1, 31), null)))
        .isInstanceOf(ConflictException.class);
    assertThat(rates.list()).hasSize(1);
  }

  @Test
  void createsAndUpdatesProfileAndPreferences() {
    var profile =
        profiles.update(
            new UserProfileRequest(
                "Ana", "Pop", "Ana", null, null, "RO", null, null, null, null, null, null, null,
                null));
    assertThat(profile.firstName()).isEqualTo("Ana");
    var prefs =
        preferences.update(
            new UserPreferencesRequest(
                "ro",
                "Europe/Berlin",
                "EUR",
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

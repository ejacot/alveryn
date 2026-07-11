package com.roomly.api.application;

import static org.assertj.core.api.Assertions.*;

import com.roomly.api.common.exception.ConflictException;
import com.roomly.api.salary.dto.HourlyRatePeriodDto;
import com.roomly.api.salary.service.HourlyRatePeriodService;
import com.roomly.api.user.dto.*;
import com.roomly.api.user.entity.*;
import com.roomly.api.user.repository.UserAccountRepository;
import com.roomly.api.user.service.*;
import com.roomly.api.worktype.dto.*;
import com.roomly.api.worktype.entity.CalculationMethod;
import com.roomly.api.worktype.service.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
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
    userId =
        users
            .save(new UserAccount("services-" + UUID.randomUUID() + "@example.com", "hash"))
            .getId();
  }

  @Test
  void managesWorkAndUnitTypesWithinOwnership() {
    var work =
        workTypes.create(
            userId,
            new CreateWorkTypeRequest(
                "Rooms", CalculationMethod.UNIT_BASED, "#87C95A", null, 0, 0));
    assertThat(workTypes.list(userId)).hasSize(1);
    var unit =
        unitTypes.create(
            userId, new UnitTypeDto(null, work.id(), "Normal", new BigDecimal("2.4"), 0, true));
    assertThat(unitTypes.get(userId, unit.id()).name()).isEqualTo("Normal");
    unitTypes.delete(userId, unit.id());
    assertThat(unitTypes.list(userId, work.id())).isEmpty();
    workTypes.delete(userId, work.id());
    assertThat(workTypes.list(userId)).isEmpty();
  }

  @Test
  void workTypeUpdatePreservesCalculationMethod() {
    var created =
        workTypes.create(
            userId,
            new CreateWorkTypeRequest(
                "Units", CalculationMethod.UNIT_BASED, "#87C95A", null, 0, 0));
    var updated =
        workTypes.update(
            userId,
            created.id(),
            new UpdateWorkTypeRequest("Renamed", "#AABBCC", "icon", 15, 3, true));
    assertThat(updated.calculationMethod()).isEqualTo(CalculationMethod.UNIT_BASED);
    assertThat(updated.name()).isEqualTo("Renamed");
    assertThat(updated.color()).isEqualTo("#AABBCC");
  }

  @Test
  void salaryServiceRejectsOverlappingPeriods() {
    rates.create(
        userId,
        new HourlyRatePeriodDto(
            null,
            userId,
            new BigDecimal("15.50"),
            "EUR",
            LocalDate.of(2025, 1, 1),
            LocalDate.of(2025, 1, 31)));
    assertThatThrownBy(
            () ->
                rates.create(
                    userId,
                    new HourlyRatePeriodDto(
                        null,
                        userId,
                        new BigDecimal("17.50"),
                        "EUR",
                        LocalDate.of(2025, 1, 31),
                        null)))
        .isInstanceOf(ConflictException.class);
    assertThat(rates.list(userId)).hasSize(1);
  }

  @Test
  void createsAndUpdatesProfileAndPreferences() {
    var profile =
        profiles.createOrUpdate(
            userId,
            new UserProfileDto(
                null, userId, "Ana", "Pop", "Ana", null, null, "RO", null, null, null, null, null,
                null, null, null));
    assertThat(profile.firstName()).isEqualTo("Ana");
    var prefs =
        preferences.createOrUpdate(
            userId,
            new UserPreferencesDto(
                null,
                userId,
                "ro",
                "Europe/Berlin",
                "EUR",
                FirstDayOfWeek.MONDAY,
                "DD.MM.YYYY",
                TimeFormat.H24,
                ThemePreference.SYSTEM,
                30,
                480,
                true));
    assertThat(prefs.onboardingCompleted()).isTrue();
    assertThat(preferences.get(userId).preferredDailyMinutes()).isEqualTo(480);
  }
}

package com.roomly.api.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;

import com.roomly.api.absence.entity.Absence;
import com.roomly.api.absence.entity.AbsenceType;
import com.roomly.api.salary.entity.HourlyRatePeriod;
import com.roomly.api.user.entity.UserAccount;
import com.roomly.api.user.entity.UserPreferences;
import com.roomly.api.user.entity.UserProfile;
import com.roomly.api.workentry.entity.TimeEntryDetails;
import com.roomly.api.workentry.entity.UnitEntryItem;
import com.roomly.api.workentry.entity.WorkEntry;
import com.roomly.api.worktype.entity.CalculationMethod;
import com.roomly.api.worktype.entity.UnitType;
import com.roomly.api.worktype.entity.WorkType;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import org.junit.jupiter.api.Test;

class DomainModelTest {
  private final UserAccount user = new UserAccount("user@example.com", "hash");

  @Test
  void validatesProfileEmploymentDates() {
    var profile = new UserProfile(user);
    profile.updateEmploymentDates(LocalDate.of(2025, 1, 1), LocalDate.of(2025, 12, 31));
    assertThatIllegalArgumentException()
        .isThrownBy(
            () ->
                profile.updateEmploymentDates(LocalDate.of(2025, 2, 1), LocalDate.of(2025, 1, 31)));
  }

  @Test
  void preferencesHaveSafeDefaultsAndValidation() {
    var preferences = new UserPreferences(user);
    assertThat(preferences.getCurrency()).isEqualTo("EUR");
    assertThat(preferences.getDefaultBreakMinutes()).isEqualTo(30);
    assertThatIllegalArgumentException()
        .isThrownBy(() -> preferences.changeDefaultBreakMinutes(-1));
    assertThatIllegalArgumentException()
        .isThrownBy(() -> preferences.changePreferredDailyMinutes(0));
    assertThatIllegalArgumentException().isThrownBy(() -> preferences.changeCurrency("EU"));
    assertThatIllegalArgumentException().isThrownBy(() -> preferences.changeTimezone(" "));
  }

  @Test
  void hourlyRateValidatesAndMatchesClosedRange() {
    var rate =
        new HourlyRatePeriod(
            user,
            new BigDecimal("17.50"),
            "eur",
            LocalDate.of(2025, 1, 1),
            LocalDate.of(2025, 1, 31));
    assertThat(rate.getCurrency()).isEqualTo("EUR");
    assertThat(rate.includes(LocalDate.of(2025, 1, 31))).isTrue();
    assertThatIllegalArgumentException()
        .isThrownBy(
            () ->
                new HourlyRatePeriod(user, new BigDecimal("-0.01"), "EUR", LocalDate.now(), null));
    assertThatIllegalArgumentException()
        .isThrownBy(
            () ->
                new HourlyRatePeriod(
                    user,
                    BigDecimal.ONE,
                    "EUR",
                    LocalDate.of(2025, 2, 1),
                    LocalDate.of(2025, 1, 1)));
  }

  @Test
  void workTypeNormalizesAndValidatesConfiguration() {
    var type = new WorkType(user, "  Checker  ", CalculationMethod.TIME_BASED);
    assertThat(type.getNormalizedName()).isEqualTo("checker");
    type.changeColor("#aabbcc");
    assertThat(type.getColor()).isEqualTo("#AABBCC");
    assertThatIllegalArgumentException().isThrownBy(() -> type.changeColor("red"));
    assertThatIllegalArgumentException().isThrownBy(() -> type.changeDefaultBreakMinutes(-1));
    assertThatIllegalArgumentException().isThrownBy(() -> type.changeDisplayOrder(-1));
  }

  @Test
  void unitTypeRequiresUnitBasedWorkAndPositiveRate() {
    var timeBased = new WorkType(user, "Time", CalculationMethod.TIME_BASED);
    assertThatIllegalArgumentException()
        .isThrownBy(() -> new UnitType(timeBased, "Room", BigDecimal.ONE));
    var unitBased = new WorkType(user, "Units", CalculationMethod.UNIT_BASED);
    assertThatIllegalArgumentException()
        .isThrownBy(() -> new UnitType(unitBased, "Room", BigDecimal.ZERO));
  }

  @Test
  void workEntryCopiesSnapshotsAndCalculatesGross() {
    var type = new WorkType(user, "Shift", CalculationMethod.TIME_BASED);
    var entry = new WorkEntry(user, type, LocalDate.now(), new BigDecimal("15.50"), "eur", 90);
    assertThat(entry.getWorkTypeNameSnapshot()).isEqualTo("Shift");
    assertThat(entry.getCurrencySnapshot()).isEqualTo("EUR");
    assertThat(entry.getGrossAmount()).isEqualByComparingTo("23.25");
    assertThatIllegalArgumentException()
        .isThrownBy(() -> new WorkEntry(user, type, LocalDate.now(), BigDecimal.ONE, "EUR", 0));
  }

  @Test
  void workEntryRejectsWorkTypeOwnedByAnotherUser() {
    var other = new UserAccount("other@example.com", "hash");
    var type = new WorkType(other, "Other", CalculationMethod.TIME_BASED);
    assertThatIllegalArgumentException()
        .isThrownBy(() -> new WorkEntry(user, type, LocalDate.now(), BigDecimal.ONE, "EUR", 60));
  }

  @Test
  void timeDetailsSupportSameDayAndOvernightIntervals() {
    var type = new WorkType(user, "Shift", CalculationMethod.TIME_BASED);
    var entry = new WorkEntry(user, type, LocalDate.now(), BigDecimal.TEN, "EUR", 450);
    assertThat(
            new TimeEntryDetails(entry, LocalTime.of(9, 0), LocalTime.of(17, 0), 30)
                .getWorkedMinutes())
        .isEqualTo(450);
    assertThat(
            new TimeEntryDetails(entry, LocalTime.of(22, 0), LocalTime.of(6, 0), 30)
                .getWorkedMinutes())
        .isEqualTo(450);
    assertThatIllegalArgumentException()
        .isThrownBy(() -> new TimeEntryDetails(entry, LocalTime.of(9, 0), LocalTime.of(10, 0), 60));
  }

  @Test
  void unitItemCalculatesMinutesAndChecksWorkType() {
    var type = new WorkType(user, "Units", CalculationMethod.UNIT_BASED);
    var unit = new UnitType(type, "Normal", new BigDecimal("2.4"));
    var entry = new WorkEntry(user, type, LocalDate.now(), new BigDecimal("18"), "EUR", 50);
    assertThat(new UnitEntryItem(entry, unit, new BigDecimal("2")).getCalculatedMinutes())
        .isEqualTo(50);
    assertThatIllegalArgumentException()
        .isThrownBy(() -> new UnitEntryItem(entry, unit, BigDecimal.ZERO));
  }

  @Test
  void absenceSupportsSingleAndMultiDayRanges() {
    LocalDate day = LocalDate.of(2025, 7, 1);
    assertThat(new Absence(user, AbsenceType.DAY_OFF, day, day).getEndDate()).isEqualTo(day);
    assertThat(new Absence(user, AbsenceType.VACATION, day, day.plusDays(4)).getEndDate())
        .isEqualTo(day.plusDays(4));
    assertThatIllegalArgumentException()
        .isThrownBy(() -> new Absence(user, AbsenceType.SICK_LEAVE, day, day.minusDays(1)));
  }
}

package com.alveryn.api.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;

import com.alveryn.api.absence.entity.Absence;
import com.alveryn.api.absence.entity.AbsenceType;
import com.alveryn.api.salary.entity.HourlyRatePeriod;
import com.alveryn.api.employment.entity.CompensationType;
import com.alveryn.api.employment.entity.Employment;
import com.alveryn.api.time.TimeCalculator;
import com.alveryn.api.user.entity.UserAccount;
import com.alveryn.api.user.entity.EmploymentType;
import com.alveryn.api.user.entity.UserPreferences;
import com.alveryn.api.user.entity.UserProfile;
import com.alveryn.api.workrecord.entity.WorkRecord;
import com.alveryn.api.workrecord.line.entity.WorkRecordLine;
import com.alveryn.api.worktype.entity.CalculationMethod;
import com.alveryn.api.worktype.entity.WorkType;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import org.junit.jupiter.api.Test;

class DomainModelTest {
  private final UserAccount user = new UserAccount("user@example.com", "hash");
  private final Employment employment = hourlyEmployment(user, "Main job");

  @Test
  void validatesProfileEmploymentDates() {
    var profile = new UserProfile(user);
    profile.updateEmployment(LocalDate.of(2025, 1, 1), LocalDate.of(2025, 12, 31), null);
    assertThatIllegalArgumentException()
        .isThrownBy(
            () ->
                profile.updateEmployment(LocalDate.of(2025, 2, 1), LocalDate.of(2025, 1, 31), null));
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
            employment,
            new BigDecimal("17.50"),
            "eur",
            LocalDate.of(2025, 1, 1),
            LocalDate.of(2025, 1, 31));
    assertThat(rate.getCurrency()).isEqualTo("EUR");
    assertThat(rate.includes(LocalDate.of(2025, 1, 31))).isTrue();
    assertThatIllegalArgumentException()
        .isThrownBy(
            () ->
                new HourlyRatePeriod(user, employment, new BigDecimal("-0.01"), "EUR", LocalDate.now(), null));
    assertThatIllegalArgumentException()
        .isThrownBy(
            () ->
                new HourlyRatePeriod(
                    user,
                    employment,
                    BigDecimal.ONE,
                    "EUR",
                    LocalDate.of(2025, 2, 1),
                    LocalDate.of(2025, 1, 1)));
  }

  private static Employment hourlyEmployment(UserAccount owner, String name) {
    var employment = new Employment(owner, name);
    employment.configure(
        EmploymentType.FULL_TIME,
        CompensationType.HOURLY,
        LocalDate.of(2025, 1, 1),
        null,
        null,
        "EUR",
        null,
        null,
        true,
        0);
    return employment;
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
  void workRecordLineCopiesSnapshotsAndCalculatesGross() {
    var type = new WorkType(user, "Shift", CalculationMethod.TIME_BASED);
    var record = new WorkRecord(user, null, LocalDate.now(), null, null);
    var line =
        WorkRecordLine.timeHourlyDuration(record, type, 0, 90, new BigDecimal("15.50"), "eur", 0, null);
    assertThat(line.getWorkTypeNameSnapshot()).isEqualTo("Shift");
    assertThat(line.getCurrencySnapshot()).isEqualTo("EUR");
    assertThat(line.getGrossAmount()).isEqualByComparingTo("23.25");
    assertThatIllegalArgumentException()
        .isThrownBy(
            () -> WorkRecordLine.timeHourlyDuration(record, type, 0, 0, BigDecimal.ONE, "EUR", 0, null));
  }

  @Test
  void workRecordLineRejectsWorkTypeOwnedByAnotherUser() {
    var other = new UserAccount("other@example.com", "hash");
    var type = new WorkType(other, "Other", CalculationMethod.TIME_BASED);
    var record = new WorkRecord(user, null, LocalDate.now(), null, null);
    assertThatIllegalArgumentException()
        .isThrownBy(
            () -> WorkRecordLine.timeHourlyDuration(record, type, 0, 60, BigDecimal.ONE, "EUR", 0, null));
  }

  @Test
  void timeCalculatorSupportsSameDayAndOvernightIntervals() {
    assertThat(TimeCalculator.intervalMinutes(LocalTime.of(9, 0), LocalTime.of(17, 0))).isEqualTo(480);
    assertThat(TimeCalculator.intervalMinutes(LocalTime.of(22, 0), LocalTime.of(6, 0))).isEqualTo(480);
  }

  @Test
  void absenceSupportsSingleAndMultiDayRanges() {
    LocalDate day = LocalDate.of(2025, 7, 1);
    assertThat(new Absence(user, employment, AbsenceType.DAY_OFF, day, day).getEndDate()).isEqualTo(day);
    assertThat(new Absence(user, employment, AbsenceType.VACATION, day, day.plusDays(4)).getEndDate())
        .isEqualTo(day.plusDays(4));
    assertThatIllegalArgumentException()
        .isThrownBy(() -> new Absence(user, employment, AbsenceType.SICK_LEAVE, day, day.minusDays(1)));
  }
}

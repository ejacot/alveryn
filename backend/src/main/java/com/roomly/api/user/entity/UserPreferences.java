package com.roomly.api.user.entity;

import com.roomly.api.common.persistence.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import java.util.Locale;
import java.util.Objects;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "user_preferences")
public class UserPreferences extends BaseEntity {
  @OneToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "user_id", nullable = false, unique = true)
  private UserAccount user;

  @Column(nullable = false, length = 10)
  private String language = "en";

  @Column(nullable = false, length = 60)
  private String timezone = "UTC";

  @Column(nullable = false, length = 3)
  private String currency = "EUR";

  @Enumerated(EnumType.STRING)
  @Column(name = "first_day_of_week", nullable = false, length = 10)
  private FirstDayOfWeek firstDayOfWeek = FirstDayOfWeek.MONDAY;

  @Column(name = "date_format", nullable = false, length = 30)
  private String dateFormat = "dd/MM/yyyy";

  @Enumerated(EnumType.STRING)
  @Column(name = "time_format", nullable = false, length = 10)
  private TimeFormat timeFormat = TimeFormat.H24;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 10)
  private ThemePreference theme = ThemePreference.DARK;

  @Column(name = "default_break_minutes", nullable = false)
  private int defaultBreakMinutes = 30;

  @Column(name = "preferred_daily_minutes")
  private Integer preferredDailyMinutes = 480;

  @Column(name = "onboarding_completed", nullable = false)
  private boolean onboardingCompleted;

  public UserPreferences(UserAccount user) {
    this.user = Objects.requireNonNull(user, "user is required");
  }

  public void changeLanguage(String value) {
    language = required(value, "language");
  }

  public void changeTimezone(String value) {
    timezone = required(value, "timezone");
  }

  public void changeCurrency(String value) {
    if (value == null || !value.trim().matches("[A-Za-z]{3}"))
      throw new IllegalArgumentException("currency must have three letters");
    currency = value.trim().toUpperCase(Locale.ROOT);
  }

  public void changeDateFormat(String value) {
    dateFormat = required(value, "dateFormat");
  }

  public void changeDefaultBreakMinutes(int value) {
    if (value < 0) throw new IllegalArgumentException("defaultBreakMinutes must be non-negative");
    defaultBreakMinutes = value;
  }

  public void changePreferredDailyMinutes(Integer value) {
    if (value != null && value <= 0)
      throw new IllegalArgumentException("preferredDailyMinutes must be positive");
    preferredDailyMinutes = value;
  }

  public void changeFirstDayOfWeek(FirstDayOfWeek value) {
    firstDayOfWeek = Objects.requireNonNull(value);
  }

  public void changeTimeFormat(TimeFormat value) {
    timeFormat = Objects.requireNonNull(value);
  }

  public void changeTheme(ThemePreference value) {
    theme = Objects.requireNonNull(value);
  }

  public void completeOnboarding() {
    onboardingCompleted = true;
  }

  private static String required(String value, String field) {
    if (value == null || value.isBlank())
      throw new IllegalArgumentException(field + " is required");
    return value.trim();
  }
}

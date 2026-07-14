package com.roomly.api.common.config;

import com.roomly.api.user.entity.FirstDayOfWeek;
import com.roomly.api.user.entity.ThemePreference;
import com.roomly.api.user.entity.TimeFormat;
import com.roomly.api.user.entity.UserAccount;
import com.roomly.api.user.entity.UserPreferences;
import com.roomly.api.user.entity.UserProfile;
import com.roomly.api.user.repository.UserAccountRepository;
import com.roomly.api.user.repository.UserPreferencesRepository;
import com.roomly.api.user.repository.UserProfileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Profile("local")
@RequiredArgsConstructor
public class LocalDevelopmentAccountSeeder implements ApplicationRunner {
  private static final String EMAIL = "eusebiujacot@gmail.com";
  private static final String PASSWORD_HASH =
      "$2a$10$5Ivz.LtsGDiBeU8kDzRvUOWfLk6flrn36yziGwfoZWMEdOCdHay3W";

  private final UserAccountRepository users;
  private final UserProfileRepository profiles;
  private final UserPreferencesRepository preferences;

  @Override
  @Transactional
  public void run(ApplicationArguments args) {
    UserAccount user =
        users
            .findByEmailIgnoreCase(EMAIL)
            .map(this::resetAccount)
            .orElseGet(() -> users.save(verifiedAccount()));

    profiles
        .findByUserId(user.getId())
        .ifPresentOrElse(
            this::resetProfile,
            () -> {
              UserProfile profile = new UserProfile(user);
              resetProfile(profile);
              profiles.save(profile);
            });

    preferences
        .findByUserId(user.getId())
        .ifPresentOrElse(
            this::resetPreferences,
            () -> {
              UserPreferences nextPreferences = new UserPreferences(user);
              resetPreferences(nextPreferences);
              preferences.save(nextPreferences);
            });
  }

  private UserAccount verifiedAccount() {
    UserAccount user = new UserAccount(EMAIL, PASSWORD_HASH);
    return resetAccount(user);
  }

  private UserAccount resetAccount(UserAccount user) {
    user.updatePasswordHash(PASSWORD_HASH);
    user.verifyEmail();
    user.unlock();
    user.clearSecurityCode();
    return user;
  }

  private void resetProfile(UserProfile profile) {
    profile.updateDetails(
        "Eusebiu",
        "Jacot",
        "Eusebiu Jacot",
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null);
  }

  private void resetPreferences(UserPreferences userPreferences) {
    userPreferences.changeLanguage("ro");
    userPreferences.changeTimezone("Europe/Berlin");
    userPreferences.changeCurrency("EUR");
    userPreferences.changeFirstDayOfWeek(FirstDayOfWeek.MONDAY);
    userPreferences.changeDateFormat("DD.MM.YYYY");
    userPreferences.changeTimeFormat(TimeFormat.H24);
    userPreferences.changeTheme(ThemePreference.SYSTEM);
    userPreferences.changeDefaultBreakMinutes(30);
    userPreferences.changePreferredDailyMinutes(null);
    userPreferences.completeOnboarding();
  }
}

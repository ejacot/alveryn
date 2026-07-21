package com.alveryn.api.common.config;

import com.alveryn.api.user.entity.FirstDayOfWeek;
import com.alveryn.api.user.entity.ThemePreference;
import com.alveryn.api.user.entity.TimeFormat;
import com.alveryn.api.user.entity.UserAccount;
import com.alveryn.api.user.entity.UserPreferences;
import com.alveryn.api.user.entity.UserProfile;
import com.alveryn.api.user.repository.UserAccountRepository;
import com.alveryn.api.user.repository.UserPreferencesRepository;
import com.alveryn.api.user.repository.UserProfileRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Profile("local")
@Order(0)
public class LocalDevelopmentAccountSeeder implements ApplicationRunner {
  private static final String EMAIL = "eusebiujacot@gmail.com";
  private static final String PASSWORD_HASH =
      "$2a$10$5Ivz.LtsGDiBeU8kDzRvUOWfLk6flrn36yziGwfoZWMEdOCdHay3W";

  private final UserAccountRepository users;
  private final UserProfileRepository profiles;
  private final UserPreferencesRepository preferences;
  private final boolean seedAccount;
  private final boolean resetAccount;

  public LocalDevelopmentAccountSeeder(
      UserAccountRepository users,
      UserProfileRepository profiles,
      UserPreferencesRepository preferences,
      @Value("${alveryn.local-dev.seed-account:true}") boolean seedAccount,
      @Value("${alveryn.local-dev.reset-account:false}") boolean resetAccount) {
    this.users = users;
    this.profiles = profiles;
    this.preferences = preferences;
    this.seedAccount = seedAccount;
    this.resetAccount = resetAccount;
  }

  @Override
  @Transactional
  public void run(ApplicationArguments args) {
    if (!seedAccount) {
      return;
    }

    UserAccount user =
        users
            .findByEmailIgnoreCase(EMAIL)
            .map(existing -> resetAccount ? resetAccount(existing) : existing)
            .orElseGet(() -> users.save(verifiedAccount()));

    profiles
        .findByUserId(user.getId())
        .ifPresentOrElse(
            profile -> {
              if (resetAccount) {
                resetProfile(profile);
              }
            },
            () -> {
              UserProfile profile = new UserProfile(user);
              resetProfile(profile);
              profiles.save(profile);
            });

    preferences
        .findByUserId(user.getId())
        .ifPresentOrElse(
            userPreferences -> {
              if (resetAccount) {
                resetPreferences(userPreferences);
              }
            },
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

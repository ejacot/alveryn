package com.roomly.api.common.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.roomly.api.user.entity.UserAccount;
import com.roomly.api.user.entity.UserPreferences;
import com.roomly.api.user.entity.UserProfile;
import com.roomly.api.user.repository.UserAccountRepository;
import com.roomly.api.user.repository.UserPreferencesRepository;
import com.roomly.api.user.repository.UserProfileRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;

class LocalDevelopmentAccountSeederProfileTest {
  private final ApplicationContextRunner contextRunner =
      new ApplicationContextRunner().withUserConfiguration(TestConfig.class);

  @Test
  void seederIsAvailableOnlyForLocalProfile() {
    contextRunner.run(
        context -> assertThat(context).doesNotHaveBean(LocalDevelopmentAccountSeeder.class));

    contextRunner
        .withPropertyValues("spring.profiles.active=local")
        .run(context -> assertThat(context).hasSingleBean(LocalDevelopmentAccountSeeder.class));
  }

  @Test
  void existingLocalAccountIsNotResetByDefault() {
    UserAccountRepository users = mock(UserAccountRepository.class);
    UserProfileRepository profiles = mock(UserProfileRepository.class);
    UserPreferencesRepository preferences = mock(UserPreferencesRepository.class);
    UserAccount user = new UserAccount("eusebiujacot@gmail.com", "custom-hash");
    UserProfile profile = new UserProfile(user);
    UserPreferences userPreferences = new UserPreferences(user);
    userPreferences.changeLanguage("de");
    userPreferences.changeCurrency("CHF");
    userPreferences.changeDefaultBreakMinutes(45);

    when(users.findByEmailIgnoreCase("eusebiujacot@gmail.com")).thenReturn(Optional.of(user));
    when(profiles.findByUserId(user.getId())).thenReturn(Optional.of(profile));
    when(preferences.findByUserId(user.getId())).thenReturn(Optional.of(userPreferences));

    new LocalDevelopmentAccountSeeder(users, profiles, preferences, false).run(null);

    assertThat(user.getPasswordHash()).isEqualTo("custom-hash");
    assertThat(userPreferences.getLanguage()).isEqualTo("de");
    assertThat(userPreferences.getCurrency()).isEqualTo("CHF");
    assertThat(userPreferences.getDefaultBreakMinutes()).isEqualTo(45);
    verify(users, never()).save(any());
    verify(profiles, never()).save(any());
    verify(preferences, never()).save(any());
  }

  @Test
  void missingLocalAccountIsCreatedVerifiedAndOnboarded() {
    UserAccountRepository users = mock(UserAccountRepository.class);
    UserProfileRepository profiles = mock(UserProfileRepository.class);
    UserPreferencesRepository preferences = mock(UserPreferencesRepository.class);

    when(users.findByEmailIgnoreCase("eusebiujacot@gmail.com")).thenReturn(Optional.empty());
    when(users.save(any(UserAccount.class))).thenAnswer(invocation -> invocation.getArgument(0));
    when(profiles.findByUserId(null)).thenReturn(Optional.empty());
    when(preferences.findByUserId(null)).thenReturn(Optional.empty());

    new LocalDevelopmentAccountSeeder(users, profiles, preferences, false).run(null);

    verify(users).save(any(UserAccount.class));
    verify(profiles).save(any(UserProfile.class));
    verify(preferences).save(any(UserPreferences.class));
  }

  @Test
  void explicitResetPropertyAllowsLocalReset() {
    UserAccountRepository users = mock(UserAccountRepository.class);
    UserProfileRepository profiles = mock(UserProfileRepository.class);
    UserPreferencesRepository preferences = mock(UserPreferencesRepository.class);
    UserAccount user = new UserAccount("eusebiujacot@gmail.com", "custom-hash");
    UserPreferences userPreferences = new UserPreferences(user);
    userPreferences.changeLanguage("de");

    when(users.findByEmailIgnoreCase("eusebiujacot@gmail.com")).thenReturn(Optional.of(user));
    when(profiles.findByUserId(user.getId())).thenReturn(Optional.of(new UserProfile(user)));
    when(preferences.findByUserId(user.getId())).thenReturn(Optional.of(userPreferences));

    new LocalDevelopmentAccountSeeder(users, profiles, preferences, true).run(null);

    assertThat(user.getPasswordHash()).isNotEqualTo("custom-hash");
    assertThat(user.isEmailVerified()).isTrue();
    assertThat(userPreferences.getLanguage()).isEqualTo("ro");
  }

  @Configuration(proxyBeanMethods = false)
  @Import(LocalDevelopmentAccountSeeder.class)
  static class TestConfig {
    @Bean
    UserAccountRepository userAccountRepository() {
      return mock(UserAccountRepository.class);
    }

    @Bean
    UserProfileRepository userProfileRepository() {
      return mock(UserProfileRepository.class);
    }

    @Bean
    UserPreferencesRepository userPreferencesRepository() {
      return mock(UserPreferencesRepository.class);
    }
  }
}

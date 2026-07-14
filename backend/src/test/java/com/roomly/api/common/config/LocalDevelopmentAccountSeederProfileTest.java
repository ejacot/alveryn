package com.roomly.api.common.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import com.roomly.api.user.repository.UserAccountRepository;
import com.roomly.api.user.repository.UserPreferencesRepository;
import com.roomly.api.user.repository.UserProfileRepository;
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

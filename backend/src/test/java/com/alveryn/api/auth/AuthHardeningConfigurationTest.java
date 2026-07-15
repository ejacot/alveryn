package com.alveryn.api.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.alveryn.api.auth.config.AuthConfiguration;
import com.alveryn.api.auth.config.AuthProperties;
import com.alveryn.api.auth.email.AuthenticationEmailService;
import com.alveryn.api.auth.email.DefaultAuthenticationEmailService;
import com.alveryn.api.user.entity.UserAccount;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;

@ExtendWith(OutputCaptureExtension.class)
class AuthHardeningConfigurationTest {
  private final ApplicationContextRunner contextRunner =
      new ApplicationContextRunner()
          .withPropertyValues(
              "alveryn.auth.access-token-lifetime=15m",
              "alveryn.auth.refresh-token-lifetime=30d",
              "alveryn.auth.email-verification-code-lifetime=15m",
              "alveryn.auth.password-reset-code-lifetime=30m",
              "alveryn.auth.verification-resend-cooldown=1m",
              "alveryn.auth.login-max-failed-attempts=5",
              "alveryn.auth.login-lock-duration=15m")
          .withUserConfiguration(TestAuthConfig.class);

  @Test
  void authPropertiesBindWithoutFrontendVerificationUrlByDefault() {
    contextRunner
        .withPropertyValues("alveryn.auth.jwt-secret=01234567890123456789012345678901")
        .run(context -> assertThat(context.getBean(AuthProperties.class).frontendVerificationUrl()).isNull());
  }

  @Test
  void defaultProfileNeverLogsAuthCodesEvenWhenExplicitlyEnabled(CapturedOutput output) {
    contextRunner
        .withPropertyValues("alveryn.auth.jwt-secret=01234567890123456789012345678901")
        .run(
            context -> {
              AuthenticationEmailService service = context.getBean(AuthenticationEmailService.class);
              assertThatThrownBy(
                      () -> service.sendVerificationCode(new UserAccount("safe@example.com", "hash"), "654321"))
                  .isInstanceOf(RuntimeException.class);
              assertThat(context.getBean(AuthenticationEmailService.class))
                  .isInstanceOf(DefaultAuthenticationEmailService.class);
              assertThat(output.getOut()).doesNotContain("654321");
            });
  }

  @Test
  void localProfileStillNeverLogsAuthCodes(CapturedOutput output) {
    contextRunner
        .withPropertyValues(
            "spring.profiles.active=local",
            "alveryn.auth.jwt-secret=local-development-jwt-secret-32-bytes-minimum")
        .run(
            context -> {
              AuthenticationEmailService service = context.getBean(AuthenticationEmailService.class);
              assertThatThrownBy(
                      () -> service.sendVerificationCode(new UserAccount("local@example.com", "hash"), "123456"))
                  .isInstanceOf(RuntimeException.class);
              assertThat(service).isInstanceOf(DefaultAuthenticationEmailService.class);
              assertThat(output.getOut()).doesNotContain("123456");
            });
  }

  @Test
  void applicationRejectsMissingJwtSecretOutsideLocalProfile() {
    contextRunner.run(context -> assertThat(context.getStartupFailure()).isNotNull());
  }

  @Test
  void applicationRejectsShortJwtSecret() {
    contextRunner
        .withPropertyValues("alveryn.auth.jwt-secret=short-secret")
        .run(
            context ->
                assertThat(context.getStartupFailure())
                    .hasRootCauseMessage("alveryn.auth.jwt-secret must be at least 32 characters long"));
  }

  @Test
  void applicationRejectsDevelopmentJwtSecretOutsideLocalProfile() {
    contextRunner
        .withPropertyValues("alveryn.auth.jwt-secret=local-development-jwt-secret-32-bytes-minimum")
        .run(
            context ->
                assertThat(context.getStartupFailure())
                    .hasRootCauseMessage(
                        "The development JWT secret is allowed only when the local profile is active"));
  }

  @Test
  void localProfileAcceptsDevelopmentJwtSecret() {
    contextRunner
        .withPropertyValues(
            "spring.profiles.active=local",
            "alveryn.auth.jwt-secret=local-development-jwt-secret-32-bytes-minimum")
        .run(context -> assertThat(context).hasNotFailed());
  }

  @Configuration
  @EnableConfigurationProperties(AuthProperties.class)
  @Import(DefaultAuthenticationEmailService.class)
  static class TestAuthConfig extends AuthConfiguration {
    @Bean
    JavaMailSender javaMailSender() {
      return new JavaMailSenderImpl();
    }
  }
}

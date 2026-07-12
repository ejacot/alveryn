package com.roomly.api.auth.email;

import com.roomly.api.auth.config.AuthProperties;
import com.roomly.api.user.entity.UserAccount;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Primary;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

@Slf4j
@Primary
@Service
@Profile("local")
@RequiredArgsConstructor
public class LocalDevelopmentAuthenticationEmailService implements AuthenticationEmailService {
  private final DefaultAuthenticationEmailService delegate;
  private final AuthProperties properties;

  @Override
  public void sendVerificationCode(UserAccount user, String code) {
    delegate.sendVerificationCode(user, code);
    maybeExposeCode(code, "verification");
  }

  @Override
  public void sendPasswordResetCode(UserAccount user, String code) {
    delegate.sendPasswordResetCode(user, code);
    maybeExposeCode(code, "password-reset");
  }

  private void maybeExposeCode(String code, String type) {
    if (properties.devExposeCodes()) {
      log.info("Development {} code output enabled", type);
      log.info("Development {} code: {}", type, code);
    }
  }
}

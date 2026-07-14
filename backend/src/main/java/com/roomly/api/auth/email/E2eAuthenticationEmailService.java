package com.roomly.api.auth.email;

import com.roomly.api.user.entity.UserAccount;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@Profile("e2e")
public class E2eAuthenticationEmailService implements AuthenticationEmailService {
  @Override
  public void sendVerificationCode(UserAccount user, String code) {
    log.info("E2E verification email suppressed for {}", user.getEmail());
  }

  @Override
  public void sendPasswordResetCode(UserAccount user, String code) {
    log.info("E2E password reset email suppressed for {}", user.getEmail());
  }
}

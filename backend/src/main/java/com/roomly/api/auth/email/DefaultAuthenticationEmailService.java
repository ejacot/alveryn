package com.roomly.api.auth.email;

import com.roomly.api.user.entity.UserAccount;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class DefaultAuthenticationEmailService implements AuthenticationEmailService {
  private final ObjectProvider<JavaMailSender> mailSenderProvider;

  @Override
  public void sendVerificationCode(UserAccount user, String code) {
    send(
        user.getEmail(),
        "Verify your Roomly email",
        "Your Roomly verification code is: " + code,
        "Verification email dispatch attempted");
  }

  @Override
  public void sendPasswordResetCode(UserAccount user, String code) {
    send(
        user.getEmail(),
        "Reset your Roomly password",
        "Your Roomly password reset code is: " + code,
        "Password reset email dispatch attempted");
  }

  private void send(String to, String subject, String text, String safeLogMessage) {
    try {
      JavaMailSender mailSender = mailSenderProvider.getIfAvailable();
      if (mailSender == null) {
        throw new IllegalStateException("JavaMailSender is not configured");
      }
      SimpleMailMessage message = new SimpleMailMessage();
      message.setTo(to);
      message.setSubject(subject);
      message.setText(text);
      mailSender.send(message);
      log.info("{}", safeLogMessage);
    } catch (Exception ex) {
      log.warn("{} but email delivery failed", safeLogMessage);
    }
  }
}

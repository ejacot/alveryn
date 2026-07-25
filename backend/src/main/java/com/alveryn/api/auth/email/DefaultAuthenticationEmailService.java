package com.alveryn.api.auth.email;

import com.alveryn.api.user.entity.UserAccount;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import java.io.UnsupportedEncodingException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.MailPreparationException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@Profile("!e2e")
@RequiredArgsConstructor
public class DefaultAuthenticationEmailService implements AuthenticationEmailService {
  private final JavaMailSender mailSender;
  @Value("${spring.mail.from:${spring.mail.username:}}")
  private String mailFrom;

  @Override
  public void sendVerificationCode(UserAccount user, String code) {
    send(
        user.getEmail(),
        "Verify your Alveryn email",
        "Verify your email",
        "Use this code to finish setting up your Alveryn account.",
        "Your Alveryn verification code is: " + code,
        code,
        "This code expires soon. If you did not create an Alveryn account, you can safely ignore this email.",
        "Verification email dispatch attempted");
  }

  @Override
  public void sendPasswordResetCode(UserAccount user, String code) {
    send(
        user.getEmail(),
        "Reset your Alveryn password",
        "Reset your password",
        "Use this code to choose a new password for your Alveryn account.",
        "Your Alveryn password reset code is: " + code,
        code,
        "This code expires soon. If you did not request a password reset, you can safely ignore this email.",
        "Password reset email dispatch attempted");
  }

  private void send(
      String to,
      String subject,
      String heading,
      String introduction,
      String text,
      String code,
      String securityNote,
      String safeLogMessage) {
    try {
      MimeMessage message = mailSender.createMimeMessage();
      MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
      if (mailFrom != null && !mailFrom.isBlank()) {
        helper.setFrom(mailFrom, "Alveryn");
      }
      helper.setTo(to);
      helper.setSubject(subject);
      helper.setText(text + "\n\n" + securityNote + "\n\nAlveryn — Work, clearly.", AlverynEmailTemplate.render(
          subject, heading, introduction, code, securityNote));
      mailSender.send(message);
      log.info("{}", safeLogMessage);
    } catch (MessagingException | UnsupportedEncodingException ex) {
      log.warn("{} but email preparation failed", safeLogMessage);
      throw new MailPreparationException("Could not prepare authentication email", ex);
    } catch (MailException ex) {
      log.warn("{} but email delivery failed", safeLogMessage);
      throw ex;
    }
  }
}

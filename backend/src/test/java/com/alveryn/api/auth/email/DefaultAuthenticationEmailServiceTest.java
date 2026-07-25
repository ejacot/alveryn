package com.alveryn.api.auth.email;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.alveryn.api.user.entity.UserAccount;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Properties;
import org.junit.jupiter.api.Test;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.util.ReflectionTestUtils;

class DefaultAuthenticationEmailServiceTest {
  @Test
  void passwordResetEmailUsesAlverynHtmlTemplateAndPlainTextFallback() throws Exception {
    JavaMailSender mailSender = mock(JavaMailSender.class);
    MimeMessage message = new MimeMessage(Session.getInstance(new Properties()));
    when(mailSender.createMimeMessage()).thenReturn(message);

    DefaultAuthenticationEmailService service = new DefaultAuthenticationEmailService(mailSender);
    ReflectionTestUtils.setField(service, "mailFrom", "no-reply@alveryn.com");

    service.sendPasswordResetCode(new UserAccount("person@example.com", "hash"), "123456");

    verify(mailSender).send(message);
    ByteArrayOutputStream output = new ByteArrayOutputStream();
    message.writeTo(output);
    String source = output.toString(StandardCharsets.UTF_8);

    assertThat(source)
        .contains("From: Alveryn <no-reply@alveryn.com>")
        .contains("To: person@example.com")
        .contains("Subject: Reset your Alveryn password")
        .contains("multipart/alternative")
        .contains("text/plain")
        .contains("text/html")
        .contains("Alveryn")
        .contains("123456");
  }

  @Test
  void templateEscapesDynamicContentAndUsesOfficialBranding() {
    String html =
        AlverynEmailTemplate.render(
            "Subject", "Verify <email>", "Use A & B", "123456", "Don't share it.");

    assertThat(html)
        .contains("Verify &lt;email&gt;")
        .contains("Use A &amp; B")
        .contains("Don&#39;t share it.")
        .contains("https://alveryn.com/brand/alveryn-mark.png")
        .contains("font-family:Sora")
        .contains(">ALVERYN</");
  }
}

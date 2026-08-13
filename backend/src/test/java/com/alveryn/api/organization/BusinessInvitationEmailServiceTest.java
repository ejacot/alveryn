package com.alveryn.api.organization;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;
import com.alveryn.api.organization.service.BusinessInvitationEmailService;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Properties;
import org.junit.jupiter.api.Test;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.util.ReflectionTestUtils;
class BusinessInvitationEmailServiceTest{
 @Test void sendsLocalizedInvitationWithAccountCreationLink()throws Exception{
  JavaMailSender sender=mock(JavaMailSender.class);MimeMessage message=new MimeMessage(Session.getInstance(new Properties()));when(sender.createMimeMessage()).thenReturn(message);
  var service=new BusinessInvitationEmailService(sender);ReflectionTestUtils.setField(service,"mailFrom","no-reply@alveryn.com");ReflectionTestUtils.setField(service,"baseUrl","https://alveryn.com");
  service.send("maria+work@example.com","Hotel Berlin","ro",false);verify(sender).send(message);
  var output=new ByteArrayOutputStream();message.writeTo(output);String source=output.toString(StandardCharsets.UTF_8);
  assertThat(message.getSubject()).isEqualTo("Invitație în Hotel Berlin");
  assertThat(source).contains("maria%2Bwork%40example.com").contains("/register").contains("ALVERYN");
 }
}

package com.alveryn.api.organization.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import lombok.RequiredArgsConstructor;

@Service @Profile("!e2e") @RequiredArgsConstructor
public class DefaultOrganizationInvitationMailer implements OrganizationInvitationMailer {
  private final JavaMailSender mailSender;
  @Value("${spring.mail.username:}") private String from;
  @Value("${alveryn.frontend-base-url:https://alveryn.com}") private String frontend;
  public void send(String email, String organizationName, String token) {
    var message = new SimpleMailMessage();
    if (from != null && !from.isBlank()) message.setFrom(from);
    message.setTo(email);
    message.setSubject("Join " + organizationName + " on Alveryn");
    message.setText("You were invited to " + organizationName + ". Accept the invitation: "
        + frontend + "/accept-invitation?token=" + token);
    mailSender.send(message);
  }
}

package com.alveryn.api.organization.service;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;
@Service @Profile("e2e")
public class E2eOrganizationInvitationMailer implements OrganizationInvitationMailer {
  public void send(String email, String organizationName, String token) {}
}

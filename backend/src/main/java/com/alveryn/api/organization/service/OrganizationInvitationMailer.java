package com.alveryn.api.organization.service;
public interface OrganizationInvitationMailer {
  void send(String email, String organizationName, String token);
}

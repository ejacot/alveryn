package com.alveryn.api.organization.service;

import com.alveryn.api.organization.entity.*;
import com.alveryn.api.organization.repository.*;
import com.alveryn.api.user.entity.UserAccount;
import com.alveryn.api.user.repository.UserPreferencesRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class PersonalWorkspaceService {
  private final OrganizationRepository organizations;
  private final OrganizationMembershipRepository memberships;
  private final UserPreferencesRepository preferences;

  public WorkspaceContext requireOrCreate(UserAccount user) {
    Organization organization = organizations.findByPersonalOwnerId(user.getId()).orElseGet(() -> {
      String timezone = preferences.findByUserId(user.getId()).map(value -> value.getTimezone()).orElse("UTC");
      return organizations.save(new Organization(user, user.getEmail(), timezone));
    });
    OrganizationMembership membership = memberships.findByOrganizationIdAndUserId(organization.getId(), user.getId())
        .orElseGet(() -> memberships.save(new OrganizationMembership(organization, user, MembershipRole.OWNER)));
    return new WorkspaceContext(organization, membership);
  }

  public record WorkspaceContext(Organization organization, OrganizationMembership membership) {}
}

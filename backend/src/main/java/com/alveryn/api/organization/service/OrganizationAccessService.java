package com.alveryn.api.organization.service;

import com.alveryn.api.auth.security.AuthenticatedUserAccessor;
import com.alveryn.api.common.exception.NotFoundException;
import com.alveryn.api.organization.entity.*;
import com.alveryn.api.organization.repository.OrganizationMembershipRepository;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service @RequiredArgsConstructor
public class OrganizationAccessService {
  private final OrganizationMembershipRepository memberships;
  private final AuthenticatedUserAccessor users;
  public OrganizationMembership requireMember(UUID organizationId) {
    return memberships.findByOrganizationIdAndUserId(organizationId, users.requireUserId())
        .filter(value -> value.getStatus() == MembershipStatus.ACTIVE)
        .orElseThrow(() -> new NotFoundException("Organization", organizationId));
  }
  public OrganizationMembership requireManager(UUID organizationId) {
    var membership = requireMember(organizationId);
    if (!Set.of(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.MANAGER).contains(membership.getRole()))
      throw new com.alveryn.api.common.exception.ForbiddenException("Manager permission is required");
    return membership;
  }
  public OrganizationMembership requireAdmin(UUID organizationId) {
    var membership = requireMember(organizationId);
    if (!Set.of(MembershipRole.OWNER, MembershipRole.ADMIN).contains(membership.getRole()))
      throw new com.alveryn.api.common.exception.ForbiddenException("Admin permission is required");
    return membership;
  }
}

package com.alveryn.api.organization.service;

import com.alveryn.api.auth.security.AuthenticatedUserAccessor;
import com.alveryn.api.organization.dto.*;
import com.alveryn.api.organization.entity.*;
import com.alveryn.api.organization.repository.*;
import com.alveryn.api.user.repository.UserAccountRepository;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @RequiredArgsConstructor
public class OrganizationService {
  private final OrganizationRepository organizations;
  private final OrganizationMembershipRepository memberships;
  private final UserAccountRepository users;
  private final AuthenticatedUserAccessor authenticated;
  private final OrganizationAccessService access;

  @Transactional(readOnly=true)
  public List<OrganizationResponse> list() {
    return memberships.findAllByUserIdAndStatusOrderByJoinedAtAsc(authenticated.requireUserId(), MembershipStatus.ACTIVE)
        .stream().map(this::response).toList();
  }
  @Transactional
  public OrganizationResponse create(OrganizationRequest request) {
    var user = users.findById(authenticated.requireUserId()).orElseThrow();
    var organization = organizations.save(new Organization(request.name(), request.timezone()));
    return response(memberships.save(new OrganizationMembership(organization, user, MembershipRole.OWNER)));
  }
  @Transactional
  public OrganizationResponse update(UUID id, OrganizationRequest request) {
    var member = access.requireAdmin(id);
    member.getOrganization().update(request.name(), request.timezone());
    return response(member);
  }
  @Transactional(readOnly=true)
  public List<MemberResponse> members(UUID id) {
    access.requireMember(id);
    return memberships.findAllByOrganizationIdOrderByJoinedAtAsc(id).stream().map(this::member).toList();
  }
  @Transactional
  public MemberResponse changeRole(UUID id, UUID membershipId, MemberRoleRequest request) {
    access.requireAdmin(id);
    var member = requireMembership(id, membershipId);
    member.changeRole(request.role());
    return member(member);
  }
  @Transactional
  public MemberResponse suspend(UUID id, UUID membershipId) {
    access.requireAdmin(id);
    var member = requireMembership(id, membershipId);
    member.suspend();
    return member(member);
  }
  private OrganizationMembership requireMembership(UUID id, UUID membershipId) {
    return memberships.findById(membershipId)
        .filter(value -> value.getOrganization().getId().equals(id))
        .orElseThrow(() -> new com.alveryn.api.common.exception.NotFoundException("Membership", membershipId));
  }
  private OrganizationResponse response(OrganizationMembership value) {
    var org=value.getOrganization();
    return new OrganizationResponse(org.getId(),org.getName(),org.getOrganizationType(),org.getTimezone(),
        value.getRole(),value.getStatus());
  }
  private MemberResponse member(OrganizationMembership value) {
    return new MemberResponse(value.getId(),value.getUser().getId(),value.getUser().getEmail(),
        value.getRole(),value.getStatus(),value.getJoinedAt());
  }
}

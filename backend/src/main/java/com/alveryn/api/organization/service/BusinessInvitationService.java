package com.alveryn.api.organization.service;

import com.alveryn.api.auth.security.AuthenticatedUserAccessor;
import com.alveryn.api.common.exception.*;
import com.alveryn.api.organization.dto.BusinessInvitationResponse;
import com.alveryn.api.organization.entity.OrganizationMembership;
import com.alveryn.api.organization.repository.OrganizationMembershipRepository;
import com.alveryn.api.user.repository.UserAccountRepository;
import com.alveryn.api.staffing.service.StaffingPlanMutationCoordinator;
import jakarta.persistence.EntityManager;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.*;
import java.util.HexFormat;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @RequiredArgsConstructor
public class BusinessInvitationService {
  private final OrganizationMembershipRepository memberships;
  private final UserAccountRepository users;
  private final AuthenticatedUserAccessor currentUser;
  private final Clock clock;
  private final StaffingPlanMutationCoordinator staffingMutations;
  private final EntityManager entityManager;

  @Transactional(readOnly = true) public BusinessInvitationResponse get(String token) {
    var member = find(token); return response(member);
  }
  @Transactional public BusinessInvitationResponse accept(String token) {
    var member = find(token); requireValid(member);
    var user = users.findById(currentUser.requireUserId()).orElseThrow();
    if (!user.getEmail().equalsIgnoreCase(member.getInvitedEmail()))
      throw new AccessDeniedException("Invitation belongs to another email address");
    if (memberships.findByOrganizationIdAndUserId(member.getOrganization().getId(), user.getId()).isPresent())
      throw new ConflictException("User is already a member of this organization");
    var organizationId = member.getOrganization().getId();
    return staffingMutations.mutateScopes(organizationId,
        staffingMutations.memberScopes(organizationId, member.getId()), member, null, () -> {
          entityManager.refresh(member);
          requireValid(member);
          member.claim(user);
          return StaffingPlanMutationCoordinator.Change.changed(response(member), member.getId());
        }).value();
  }
  @Transactional public BusinessInvitationResponse decline(String token) {
    var member = find(token); requireValid(member); member.declineInvitation(); return response(member);
  }
  private OrganizationMembership find(String token) {
    return memberships.findByInvitationTokenHash(hash(token))
        .orElseThrow(() -> new NotFoundException("Business invitation", token));
  }
  private void requireValid(OrganizationMembership member) {
    if (!member.invitationIsValid(OffsetDateTime.now(clock)))
      throw new ValidationException("Invitation has expired", "INVITATION_EXPIRED");
  }
  private BusinessInvitationResponse response(OrganizationMembership member) {
    String status = member.invitationIsValid(OffsetDateTime.now(clock)) ? "PENDING"
        : member.getStatus() == com.alveryn.api.organization.entity.MembershipStatus.INVITED
            ? "EXPIRED" : member.getStatus().name();
    return new BusinessInvitationResponse(member.getOrganization().getName(), member.getInvitedEmail(),
        member.getInvitationExpiresAt(), status);
  }
  public static String hash(String token) {
    try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
        .digest(token.getBytes(StandardCharsets.UTF_8))); }
    catch (Exception exception) { throw new IllegalStateException(exception); }
  }
}

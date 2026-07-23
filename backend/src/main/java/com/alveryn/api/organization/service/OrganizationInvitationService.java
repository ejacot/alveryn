package com.alveryn.api.organization.service;

import com.alveryn.api.auth.security.AuthenticatedUserAccessor;
import com.alveryn.api.auth.util.AuthTokenGenerator;
import com.alveryn.api.auth.util.TokenHashingService;
import com.alveryn.api.common.exception.*;
import com.alveryn.api.organization.dto.*;
import com.alveryn.api.organization.entity.*;
import com.alveryn.api.organization.repository.*;
import com.alveryn.api.user.repository.UserAccountRepository;
import java.time.*;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @RequiredArgsConstructor
public class OrganizationInvitationService {
  private final OrganizationInvitationRepository invitations;
  private final OrganizationMembershipRepository memberships;
  private final UserAccountRepository users;
  private final OrganizationAccessService access;
  private final AuthenticatedUserAccessor authenticated;
  private final AuthTokenGenerator tokens;
  private final TokenHashingService hashing;
  private final OrganizationInvitationMailer mailer;
  private final Clock clock;

  @Transactional
  public InvitationResponse invite(UUID organizationId, InvitationRequest request) {
    var inviter = access.requireAdmin(organizationId);
    if (request.role() == MembershipRole.OWNER) throw new IllegalArgumentException("owner cannot be invited");
    String normalized = request.email().trim().toLowerCase(Locale.ROOT);
    users.findByEmailIgnoreCase(normalized).ifPresent(user -> {
      if (memberships.findByOrganizationIdAndUserId(organizationId, user.getId()).isPresent())
        throw new ConflictException("User is already a member");
    });
    if (invitations.existsByOrganizationIdAndNormalizedEmailAndAcceptedAtIsNullAndRevokedAtIsNull(
        organizationId, normalized)) throw new ConflictException("An invitation is already pending");
    String plain = tokens.generateOpaqueToken();
    var invitation = invitations.save(new OrganizationInvitation(inviter.getOrganization(), normalized,
        request.role(), hashing.sha256Hex(plain), inviter, OffsetDateTime.now(clock).plusDays(7)));
    mailer.send(normalized, inviter.getOrganization().getName(), plain);
    return response(invitation);
  }
  @Transactional(readOnly=true)
  public List<InvitationResponse> list(UUID organizationId) {
    access.requireAdmin(organizationId);
    return invitations.findAllByOrganizationIdOrderByCreatedAtDesc(organizationId).stream().map(this::response).toList();
  }
  @Transactional
  public InvitationResponse revoke(UUID organizationId, UUID invitationId) {
    access.requireAdmin(organizationId);
    var invitation = invitations.findById(invitationId)
        .filter(value -> value.getOrganization().getId().equals(organizationId))
        .orElseThrow(() -> new NotFoundException("Invitation", invitationId));
    invitation.revoke(OffsetDateTime.now(clock));
    return response(invitation);
  }
  @Transactional
  public OrganizationResponse accept(AcceptInvitationRequest request) {
    var user = users.findById(authenticated.requireUserId()).orElseThrow();
    var invitation = invitations.findByTokenHash(hashing.sha256Hex(request.token()))
        .orElseThrow(() -> new NotFoundException("Invitation", UUID.randomUUID()));
    var now = OffsetDateTime.now(clock);
    if (!invitation.canAccept(now) || !invitation.getNormalizedEmail().equals(user.getEmail().toLowerCase(Locale.ROOT)))
      throw new IllegalArgumentException("invitation is invalid or expired");
    if (memberships.findByOrganizationIdAndUserId(invitation.getOrganization().getId(), user.getId()).isPresent())
      throw new ConflictException("User is already a member");
    invitation.accept(now);
    var member = memberships.save(new OrganizationMembership(invitation.getOrganization(), user, invitation.getRole()));
    var org=member.getOrganization();
    return new OrganizationResponse(org.getId(),org.getName(),org.getOrganizationType(),org.getTimezone(),
        member.getRole(),member.getStatus());
  }
  private InvitationResponse response(OrganizationInvitation value) {
    return new InvitationResponse(value.getId(),value.getOrganization().getId(),value.getOrganization().getName(),
        value.getEmail(),value.getRole(),value.getExpiresAt(),value.getAcceptedAt(),value.getRevokedAt());
  }
}

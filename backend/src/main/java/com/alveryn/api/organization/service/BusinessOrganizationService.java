package com.alveryn.api.organization.service;

import com.alveryn.api.auth.security.AuthenticatedUserAccessor;
import com.alveryn.api.common.exception.NotFoundException;
import com.alveryn.api.organization.dto.*;
import com.alveryn.api.organization.entity.*;
import com.alveryn.api.organization.repository.*;
import com.alveryn.api.user.repository.UserAccountRepository;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class BusinessOrganizationService {
  private final AuthenticatedUserAccessor currentUser;
  private final UserAccountRepository users;
  private final OrganizationRepository organizations;
  private final OrganizationMembershipRepository memberships;
  private final OrganizationUnitRepository units;
  private final OrganizationRoleRepository roles;
  private final OrganizationRoleAssignmentRepository roleAssignments;
  private final BusinessInvitationEmailService invitationEmails;
  private final OrganizationAccessService access;

  @Transactional(readOnly = true)
  public List<OrganizationResponse> list() {
    return memberships.findAllByUserIdAndStatusOrderByCreatedAtAsc(
            currentUser.requireUserId(), MembershipStatus.ACTIVE).stream()
        .map(this::response).toList();
  }

  @Transactional(readOnly = true)
  public OrganizationAccessResponse access(UUID organizationId) {
    return new OrganizationAccessResponse(access.permissions(organizationId));
  }

  @Transactional
  public OrganizationResponse create(CreateBusinessOrganizationRequest request) {
    var user = users.findById(currentUser.requireUserId())
        .orElseThrow(() -> new NotFoundException("User", currentUser.requireUserId()));
    var organization = organizations.save(new Organization(request.name(), request.timezone()));
    var membership = memberships.save(new OrganizationMembership(organization, user, MembershipRole.OWNER));
    return response(membership);
  }

  @Transactional(readOnly = true)
  public List<OrganizationUnitResponse> listUnits(UUID organizationId) {
    access.require(organizationId, OrganizationPermission.MANAGE_TEAMS,
        OrganizationPermission.VIEW_SCHEDULE, OrganizationPermission.MANAGE_SCHEDULE,
        OrganizationPermission.MANAGE_ROLES);
    return units.findAllByOrganizationIdOrderByDisplayOrderAscNameAsc(organizationId).stream()
        .map(this::response).toList();
  }

  @Transactional
  public OrganizationUnitResponse createUnit(UUID organizationId, CreateOrganizationUnitRequest request) {
    var membership = access.require(organizationId, OrganizationPermission.MANAGE_TEAMS);
    var organization = membership.getOrganization();
    if (organization.getOrganizationType() != OrganizationType.BUSINESS) {
      throw new IllegalArgumentException("units can only be created in business organizations");
    }
    OrganizationUnit parent = request.parentId() == null ? null
        : units.findByIdAndOrganizationId(request.parentId(), organizationId)
            .orElseThrow(() -> new NotFoundException("Organization unit", request.parentId()));
    var unit = new OrganizationUnit(organization, parent, request.name(), request.type(),
        request.checkInMode(), request.displayOrder() == null ? 0 : request.displayOrder());
    return response(units.save(unit));
  }

  @Transactional(readOnly = true)
  public List<OrganizationMemberResponse> listMembers(UUID organizationId) {
    access.require(organizationId, OrganizationPermission.MANAGE_MEMBERS,
        OrganizationPermission.VIEW_SCHEDULE, OrganizationPermission.MANAGE_SCHEDULE,
        OrganizationPermission.MANAGE_ROLES);
    return memberships.findAllByOrganizationIdOrderByCreatedAtAsc(organizationId).stream()
        .map(this::memberResponse).toList();
  }

  @Transactional
  public OrganizationMemberResponse createMember(UUID organizationId,
      CreateOrganizationMemberRequest request) {
    var manager = access.require(organizationId, OrganizationPermission.MANAGE_MEMBERS);
    if (manager.getOrganization().getOrganizationType() != OrganizationType.BUSINESS) {
      throw new IllegalArgumentException("members can only be created in business organizations");
    }
    var member = new OrganizationMembership(manager.getOrganization(), request.firstName(),
        request.lastName(), request.email());
    if (request.email() != null && !request.email().isBlank()) {
      users.findByEmailIgnoreCase(request.email().trim()).filter(value -> value.isEmailVerified() && !value.isDeleted())
          .ifPresent(user -> {
            if (memberships.findByOrganizationIdAndUserId(organizationId, user.getId()).isPresent()) {
              throw new com.alveryn.api.common.exception.ConflictException("This user is already a member of the organization");
            }
            member.claim(user);
          });
    }
    var saved=memberships.save(member);
    if(request.email()!=null&&!request.email().isBlank()) invitationEmails.send(request.email().trim(),manager.getOrganization().getName(),request.language(),saved.getStatus()==MembershipStatus.ACTIVE);
    return memberResponse(saved);
  }

  @Transactional(readOnly=true)
  public void resendInvitation(UUID organizationId,UUID membershipId,String language){var manager=access.require(organizationId,OrganizationPermission.MANAGE_MEMBERS);var member=memberships.findByIdAndOrganizationId(membershipId,organizationId).orElseThrow(()->new NotFoundException("Organization member",membershipId));String email=member.getUser()!=null?member.getUser().getEmail():member.getInvitedEmail();if(email==null)throw new IllegalArgumentException("member has no email");invitationEmails.send(email,manager.getOrganization().getName(),language,member.getStatus()==MembershipStatus.ACTIVE);}

  @Transactional
  public OrganizationMemberResponse suspendMember(UUID organizationId, UUID membershipId) {
    access.require(organizationId, OrganizationPermission.MANAGE_MEMBERS);
    var member = memberships.findByIdAndOrganizationId(membershipId, organizationId)
        .orElseThrow(() -> new NotFoundException("Organization member", membershipId));
    member.suspend();
    return memberResponse(member);
  }

  @Transactional
  public OrganizationMemberResponse reactivateMember(UUID organizationId, UUID membershipId) {
    access.require(organizationId, OrganizationPermission.MANAGE_MEMBERS);
    var member = memberships.findByIdAndOrganizationId(membershipId, organizationId)
        .orElseThrow(() -> new NotFoundException("Organization member", membershipId));
    member.reactivate();
    return memberResponse(member);
  }

  @Transactional(readOnly = true)
  public List<OrganizationRoleResponse> listRoles(UUID organizationId) {
    access.require(organizationId, OrganizationPermission.MANAGE_ROLES);
    return roles.findAllByOrganizationIdOrderByNameAsc(organizationId).stream()
        .map(this::roleResponse).toList();
  }

  @Transactional
  public OrganizationRoleResponse createRole(UUID organizationId, CreateOrganizationRoleRequest request) {
    var manager = access.require(organizationId, OrganizationPermission.MANAGE_ROLES);
    var role = new OrganizationRole(manager.getOrganization(), request.name(), request.permissions());
    return roleResponse(roles.save(role));
  }

  @Transactional(readOnly = true)
  public List<OrganizationRoleAssignmentResponse> listRoleAssignments(UUID organizationId) {
    access.require(organizationId, OrganizationPermission.MANAGE_ROLES);
    return roleAssignments.findAllByMembershipOrganizationIdOrderByCreatedAtAsc(organizationId).stream()
        .map(this::roleAssignmentResponse).toList();
  }

  @Transactional
  public OrganizationRoleAssignmentResponse assignRole(UUID organizationId,
      AssignOrganizationRoleRequest request) {
    access.require(organizationId, OrganizationPermission.MANAGE_ROLES);
    var member = memberships.findByIdAndOrganizationId(request.membershipId(), organizationId)
        .orElseThrow(() -> new NotFoundException("Organization member", request.membershipId()));
    var role = roles.findByIdAndOrganizationId(request.roleId(), organizationId)
        .orElseThrow(() -> new NotFoundException("Organization role", request.roleId()));
    var unit = request.unitId() == null ? null
        : units.findByIdAndOrganizationId(request.unitId(), organizationId)
            .orElseThrow(() -> new NotFoundException("Organization unit", request.unitId()));
    return roleAssignmentResponse(roleAssignments.save(new OrganizationRoleAssignment(
        member, role, unit, request.includeDescendants() == null || request.includeDescendants())));
  }

  private OrganizationResponse response(OrganizationMembership membership) {
    var organization = membership.getOrganization();
    return new OrganizationResponse(organization.getId(), organization.getName(),
        organization.getOrganizationType(), organization.getTimezone(), membership.getRole());
  }

  private OrganizationUnitResponse response(OrganizationUnit unit) {
    return new OrganizationUnitResponse(unit.getId(), unit.getParent() == null ? null : unit.getParent().getId(),
        unit.getName(), unit.getType(), unit.getCheckInMode(), unit.isActive(), unit.getDisplayOrder());
  }

  private OrganizationMemberResponse memberResponse(OrganizationMembership membership) {
    var user = membership.getUser();
    return new OrganizationMemberResponse(membership.getId(), user == null ? null : user.getId(),
        membership.getFirstName(), membership.getLastName(),
        user == null ? membership.getInvitedEmail() : user.getEmail(), membership.getStatus());
  }

  private OrganizationRoleResponse roleResponse(OrganizationRole role) {
    var permissions = role.getPermissions().stream().map(OrganizationPermission::valueOf)
        .collect(java.util.stream.Collectors.toCollection(java.util.LinkedHashSet::new));
    return new OrganizationRoleResponse(role.getId(), role.getName(), permissions, role.isSystemRole());
  }

  private OrganizationRoleAssignmentResponse roleAssignmentResponse(OrganizationRoleAssignment value) {
    return new OrganizationRoleAssignmentResponse(value.getId(), value.getMembership().getId(),
        value.getRole().getId(), value.getUnit() == null ? null : value.getUnit().getId(),
        value.isIncludeDescendants());
  }
}

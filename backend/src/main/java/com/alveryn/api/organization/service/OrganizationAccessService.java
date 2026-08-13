package com.alveryn.api.organization.service;

import com.alveryn.api.auth.security.AuthenticatedUserAccessor;
import com.alveryn.api.common.exception.NotFoundException;
import com.alveryn.api.organization.entity.*;
import com.alveryn.api.organization.repository.OrganizationMembershipRepository;
import com.alveryn.api.organization.repository.OrganizationRoleAssignmentRepository;
import java.util.Arrays;
import java.util.EnumSet;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class OrganizationAccessService {
  private final AuthenticatedUserAccessor currentUser;
  private final OrganizationMembershipRepository memberships;
  private final OrganizationRoleAssignmentRepository assignments;

  @Transactional(readOnly = true)
  public OrganizationMembership require(UUID organizationId, OrganizationPermission... permissions) {
    var membership = activeMembership(organizationId);
    var required = Arrays.asList(permissions);
    boolean allowed = isLegacyManager(membership) || assignments.findAllByMembershipId(membership.getId()).stream()
        .flatMap(value -> value.getRole().getPermissions().stream())
        .map(OrganizationPermission::valueOf)
        .anyMatch(required::contains);
    if (!allowed) throw new AccessDeniedException("Required organization permission is missing");
    return membership;
  }

  @Transactional(readOnly = true)
  public OrganizationMembership requireForUnit(UUID organizationId, OrganizationUnit unit,
      OrganizationPermission... permissions) {
    var membership = activeMembership(organizationId);
    if (!canAccess(membership, unit, permissions)) {
      throw new AccessDeniedException("Required permission is missing for this team");
    }
    return membership;
  }

  @Transactional(readOnly = true)
  public boolean canAccess(UUID organizationId, OrganizationUnit unit,
      OrganizationPermission... permissions) {
    return canAccess(activeMembership(organizationId), unit, permissions);
  }

  @Transactional(readOnly = true)
  public Set<OrganizationPermission> permissions(UUID organizationId) {
    var membership = activeMembership(organizationId);
    if (isLegacyManager(membership)) return EnumSet.allOf(OrganizationPermission.class);
    var result = EnumSet.noneOf(OrganizationPermission.class);
    assignments.findAllByMembershipId(membership.getId()).stream()
        .flatMap(value -> value.getRole().getPermissions().stream())
        .map(OrganizationPermission::valueOf).forEach(result::add);
    return result;
  }

  private boolean canAccess(OrganizationMembership membership, OrganizationUnit target,
      OrganizationPermission... permissions) {
    if (isLegacyManager(membership)) return true;
    var required = Arrays.asList(permissions);
    return assignments.findAllByMembershipId(membership.getId()).stream()
        .filter(value -> value.getRole().getPermissions().stream()
            .map(OrganizationPermission::valueOf).anyMatch(required::contains))
        .anyMatch(value -> scopeContains(value, target));
  }

  private boolean scopeContains(OrganizationRoleAssignment assignment, OrganizationUnit target) {
    if (assignment.getUnit() == null) return true;
    if (target == null) return false;
    var current = target;
    while (current != null) {
      if (current.getId().equals(assignment.getUnit().getId())) {
        return current == target || assignment.isIncludeDescendants();
      }
      current = current.getParent();
    }
    return false;
  }

  private OrganizationMembership activeMembership(UUID organizationId) {
    return memberships.findByOrganizationIdAndUserId(organizationId, currentUser.requireUserId())
        .filter(value -> value.getStatus() == MembershipStatus.ACTIVE)
        .orElseThrow(() -> new NotFoundException("Organization", organizationId));
  }

  private boolean isLegacyManager(OrganizationMembership membership) {
    return membership.getRole() == MembershipRole.OWNER
        || membership.getRole() == MembershipRole.ADMIN
        || membership.getRole() == MembershipRole.MANAGER;
  }
}

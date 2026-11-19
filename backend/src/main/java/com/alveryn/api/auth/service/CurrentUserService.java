package com.alveryn.api.auth.service;

import com.alveryn.api.auth.dto.CurrentUserResponse;
import com.alveryn.api.auth.security.AuthenticatedUserAccessor;
import com.alveryn.api.common.exception.NotFoundException;
import com.alveryn.api.organization.entity.MembershipAccessState;
import com.alveryn.api.organization.entity.MembershipStatus;
import com.alveryn.api.organization.entity.OrganizationPermission;
import com.alveryn.api.organization.entity.OrganizationType;
import com.alveryn.api.organization.repository.OrganizationMembershipRepository;
import com.alveryn.api.organization.service.OrganizationAccessService;
import com.alveryn.api.user.mapper.UserMapper;
import com.alveryn.api.user.repository.UserAccountRepository;
import com.alveryn.api.user.repository.UserPreferencesRepository;
import com.alveryn.api.user.repository.UserProfileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CurrentUserService {
  private final AuthenticatedUserAccessor authenticatedUserAccessor;
  private final UserAccountRepository users;
  private final UserProfileRepository profiles;
  private final UserPreferencesRepository preferences;
  private final OrganizationMembershipRepository memberships;
  private final OrganizationAccessService organizationAccess;
  private final UserMapper mapper;

  @Transactional(readOnly = true)
  public CurrentUserResponse getCurrentUser() {
    var userId = authenticatedUserAccessor.requireUserId();
    var user = users.findById(userId).orElseThrow(() -> new NotFoundException("UserAccount", userId));
    var account = mapper.toDto(user);
    var profile = profiles.findByUserId(userId).map(mapper::toProfileResponse).orElse(null);
    var prefs = preferences.findByUserId(userId).map(mapper::toPreferencesResponse).orElse(null);
    var businessMemberships = memberships
        .findAllByUserIdAndStatusOrderByCreatedAtAsc(userId, MembershipStatus.ACTIVE).stream()
        .filter(membership -> membership.getAccessState() == MembershipAccessState.CLAIMED)
        .filter(membership -> membership.getOrganization().getOrganizationType() == OrganizationType.BUSINESS)
        .toList();
    var managedBusinessOrganizationIds = businessMemberships.stream()
        .filter(membership -> organizationAccess.permissions(membership).stream()
            .anyMatch(permission -> permission != OrganizationPermission.VIEW_SCHEDULE))
        .map(membership -> membership.getOrganization().getId())
        .toList();
    return new CurrentUserResponse(account, profile, prefs, user.isAdmin(),
        !businessMemberships.isEmpty(), managedBusinessOrganizationIds);
  }
}

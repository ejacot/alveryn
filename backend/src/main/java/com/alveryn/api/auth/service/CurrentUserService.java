package com.alveryn.api.auth.service;

import com.alveryn.api.auth.dto.CurrentUserResponse;
import com.alveryn.api.auth.security.AuthenticatedUserAccessor;
import com.alveryn.api.common.exception.NotFoundException;
import com.alveryn.api.organization.entity.MembershipStatus;
import com.alveryn.api.organization.entity.OrganizationType;
import com.alveryn.api.organization.repository.OrganizationMembershipRepository;
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
  private final UserMapper mapper;

  @Transactional(readOnly = true)
  public CurrentUserResponse getCurrentUser() {
    var userId = authenticatedUserAccessor.requireUserId();
    var user = users.findById(userId).orElseThrow(() -> new NotFoundException("UserAccount", userId));
    var account = mapper.toDto(user);
    var profile = profiles.findByUserId(userId).map(mapper::toProfileResponse).orElse(null);
    var prefs = preferences.findByUserId(userId).map(mapper::toPreferencesResponse).orElse(null);
    var hasBusinessWorkspace = memberships
        .findAllByUserIdAndStatusOrderByCreatedAtAsc(userId, MembershipStatus.ACTIVE).stream()
        .anyMatch(membership ->
            membership.getOrganization().getOrganizationType() == OrganizationType.BUSINESS);
    return new CurrentUserResponse(account, profile, prefs, user.isAdmin(), hasBusinessWorkspace);
  }
}

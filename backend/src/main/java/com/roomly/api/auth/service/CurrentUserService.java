package com.roomly.api.auth.service;

import com.roomly.api.auth.dto.CurrentUserResponse;
import com.roomly.api.auth.security.AuthenticatedUserAccessor;
import com.roomly.api.common.exception.NotFoundException;
import com.roomly.api.user.mapper.UserMapper;
import com.roomly.api.user.repository.UserAccountRepository;
import com.roomly.api.user.repository.UserPreferencesRepository;
import com.roomly.api.user.repository.UserProfileRepository;
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
  private final UserMapper mapper;

  @Transactional(readOnly = true)
  public CurrentUserResponse getCurrentUser() {
    var userId = authenticatedUserAccessor.requireUserId();
    var account =
        mapper.toDto(users.findById(userId).orElseThrow(() -> new NotFoundException("UserAccount", userId)));
    var profile = profiles.findByUserId(userId).map(mapper::toProfileResponse).orElse(null);
    var prefs = preferences.findByUserId(userId).map(mapper::toPreferencesResponse).orElse(null);
    return new CurrentUserResponse(account, profile, prefs);
  }
}

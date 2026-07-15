package com.alveryn.api.user.service;

import com.alveryn.api.auth.security.AuthenticatedUserAccessor;
import com.alveryn.api.common.exception.NotFoundException;
import com.alveryn.api.common.util.InputSanitizer;
import com.alveryn.api.user.dto.UserPreferencesRequest;
import com.alveryn.api.user.dto.UserPreferencesResponse;
import com.alveryn.api.user.entity.UserPreferences;
import com.alveryn.api.user.mapper.UserMapper;
import com.alveryn.api.user.repository.UserAccountRepository;
import com.alveryn.api.user.repository.UserPreferencesRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;

@Service
@Validated
@RequiredArgsConstructor
public class UserPreferencesService {
  private final AuthenticatedUserAccessor authenticatedUserAccessor;
  private final UserPreferencesRepository repository;
  private final UserAccountRepository users;
  private final UserMapper mapper;

  @Transactional
  public UserPreferencesResponse update(@Valid UserPreferencesRequest request) {
    UserPreferences preferences = getOrCreatePreferences();
    String timezone = InputSanitizer.requireTrimmed(request.timezone(), "timezone");
    InputSanitizer.validateTimezone(timezone);
    preferences.changeLanguage(InputSanitizer.requireTrimmed(request.language(), "language"));
    preferences.changeTimezone(timezone);
    preferences.changeCurrency(InputSanitizer.normalizeCurrency(request.currency()));
    preferences.changeDateFormat(InputSanitizer.requireTrimmed(request.dateFormat(), "dateFormat"));
    preferences.changeTimeFormat(request.timeFormat());
    preferences.changeTheme(request.theme());
    preferences.changeDefaultBreakMinutes(request.defaultBreakMinutes());
    preferences.changePreferredDailyMinutes(request.preferredDailyMinutes());
    return mapper.toPreferencesResponse(repository.save(preferences));
  }

  @Transactional
  public UserPreferencesResponse get() {
    return mapper.toPreferencesResponse(repository.save(getOrCreatePreferences()));
  }

  @Transactional
  public UserPreferences completeOnboarding() {
    UserPreferences preferences = getOrCreatePreferences();
    preferences.completeOnboarding();
    return repository.save(preferences);
  }

  @Transactional(readOnly = true)
  public UserPreferences findCurrentPreferencesOrNull() {
    return repository.findByUserId(authenticatedUserAccessor.requireUserId()).orElse(null);
  }

  private UserPreferences getOrCreatePreferences() {
    var userId = authenticatedUserAccessor.requireUserId();
    return repository
        .findByUserId(userId)
        .orElseGet(
            () ->
                new UserPreferences(
                    users.findById(userId).orElseThrow(() -> new NotFoundException("UserAccount", userId))));
  }
}

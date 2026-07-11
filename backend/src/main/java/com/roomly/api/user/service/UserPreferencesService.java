package com.roomly.api.user.service;

import com.roomly.api.common.exception.NotFoundException;
import com.roomly.api.user.dto.UserPreferencesDto;
import com.roomly.api.user.entity.UserPreferences;
import com.roomly.api.user.mapper.UserMapper;
import com.roomly.api.user.repository.*;
import jakarta.validation.Valid;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;

@Service
@Validated
@RequiredArgsConstructor
public class UserPreferencesService {
  private final UserPreferencesRepository repository;
  private final UserAccountRepository users;
  private final UserMapper mapper;

  @Transactional
  public UserPreferencesDto createOrUpdate(UUID userId, @Valid UserPreferencesDto dto) {
    var p =
        repository
            .findByUserId(userId)
            .orElseGet(
                () ->
                    new UserPreferences(
                        users
                            .findById(userId)
                            .orElseThrow(() -> new NotFoundException("UserAccount", userId))));
    p.changeLanguage(dto.language());
    p.changeTimezone(dto.timezone());
    p.changeCurrency(dto.currency());
    p.changeFirstDayOfWeek(dto.firstDayOfWeek());
    p.changeDateFormat(dto.dateFormat());
    p.changeTimeFormat(dto.timeFormat());
    p.changeTheme(dto.theme());
    p.changeDefaultBreakMinutes(dto.defaultBreakMinutes());
    p.changePreferredDailyMinutes(dto.preferredDailyMinutes());
    if (dto.onboardingCompleted()) p.completeOnboarding();
    return mapper.toDto(repository.save(p));
  }

  @Transactional(readOnly = true)
  public UserPreferencesDto get(UUID userId) {
    return mapper.toDto(
        repository
            .findByUserId(userId)
            .orElseThrow(() -> new NotFoundException("UserPreferences", userId)));
  }
}

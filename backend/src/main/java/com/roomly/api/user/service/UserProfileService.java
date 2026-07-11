package com.roomly.api.user.service;

import com.roomly.api.common.exception.NotFoundException;
import com.roomly.api.user.dto.UserProfileDto;
import com.roomly.api.user.entity.UserProfile;
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
public class UserProfileService {
  private final UserProfileRepository repository;
  private final UserAccountRepository users;
  private final UserMapper mapper;

  @Transactional
  public UserProfileDto createOrUpdate(UUID userId, @Valid UserProfileDto dto) {
    var profile =
        repository
            .findByUserId(userId)
            .orElseGet(
                () ->
                    new UserProfile(
                        users
                            .findById(userId)
                            .orElseThrow(() -> new NotFoundException("UserAccount", userId))));
    profile.updateDetails(
        dto.firstName(),
        dto.lastName(),
        dto.displayName(),
        dto.dateOfBirth(),
        dto.phone(),
        dto.countryCode(),
        dto.city(),
        dto.postalCode(),
        dto.street(),
        dto.houseNumber(),
        dto.apartment(),
        dto.avatarUrl());
    profile.updateEmploymentDates(dto.employmentStartDate(), dto.employmentEndDate());
    return mapper.toDto(repository.save(profile));
  }

  @Transactional(readOnly = true)
  public UserProfileDto get(UUID userId) {
    return mapper.toDto(
        repository
            .findByUserId(userId)
            .orElseThrow(() -> new NotFoundException("UserProfile", userId)));
  }
}

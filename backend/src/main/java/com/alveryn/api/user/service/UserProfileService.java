package com.alveryn.api.user.service;

import com.alveryn.api.auth.security.AuthenticatedUserAccessor;
import com.alveryn.api.common.exception.NotFoundException;
import com.alveryn.api.common.exception.ValidationException;
import com.alveryn.api.common.util.InputSanitizer;
import com.alveryn.api.user.dto.UserProfileRequest;
import com.alveryn.api.user.dto.UserProfileResponse;
import com.alveryn.api.user.entity.UserProfile;
import com.alveryn.api.user.mapper.UserMapper;
import com.alveryn.api.user.repository.UserAccountRepository;
import com.alveryn.api.user.repository.UserProfileRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;

@Service
@Validated
@RequiredArgsConstructor
public class UserProfileService {
  private final AuthenticatedUserAccessor authenticatedUserAccessor;
  private final UserProfileRepository repository;
  private final UserAccountRepository users;
  private final UserMapper mapper;

  @Transactional
  public UserProfileResponse update(@Valid UserProfileRequest request) {
    UserProfile profile = getOrCreateProfile();
    validateEmploymentDates(request);
    profile.updateDetails(
        InputSanitizer.trimToNull(request.firstName()),
        InputSanitizer.trimToNull(request.lastName()),
        InputSanitizer.trimToNull(request.displayName()),
        request.dateOfBirth(),
        InputSanitizer.trimToNull(request.phone()),
        InputSanitizer.normalizeCountryCode(request.countryCode()),
        InputSanitizer.trimToNull(request.city()),
        InputSanitizer.trimToNull(request.postalCode()),
        InputSanitizer.trimToNull(request.street()),
        InputSanitizer.trimToNull(request.houseNumber()),
        InputSanitizer.trimToNull(request.apartment()),
        InputSanitizer.trimToNull(request.avatarUrl()));
    profile.updateEmploymentDates(request.employmentStartDate(), request.employmentEndDate());
    return mapper.toProfileResponse(repository.save(profile));
  }

  @Transactional
  public UserProfileResponse get() {
    return mapper.toProfileResponse(repository.save(getOrCreateProfile()));
  }

  private UserProfile getOrCreateProfile() {
    var userId = authenticatedUserAccessor.requireUserId();
    return repository
        .findByUserId(userId)
        .orElseGet(
            () ->
                new UserProfile(
                    users.findById(userId).orElseThrow(() -> new NotFoundException("UserAccount", userId))));
  }

  private void validateEmploymentDates(UserProfileRequest request) {
    if (request.employmentStartDate() != null
        && request.employmentEndDate() != null
        && request.employmentEndDate().isBefore(request.employmentStartDate())) {
      throw new ValidationException("employmentEndDate cannot be before employmentStartDate");
    }
  }
}

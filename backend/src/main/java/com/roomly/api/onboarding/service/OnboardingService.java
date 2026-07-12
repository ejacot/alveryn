package com.roomly.api.onboarding.service;

import com.roomly.api.auth.security.AuthenticatedUserAccessor;
import com.roomly.api.common.exception.ConflictException;
import com.roomly.api.onboarding.dto.OnboardingStatusResponse;
import com.roomly.api.salary.repository.HourlyRatePeriodRepository;
import com.roomly.api.user.entity.UserPreferences;
import com.roomly.api.user.entity.UserProfile;
import com.roomly.api.user.repository.UserPreferencesRepository;
import com.roomly.api.user.repository.UserProfileRepository;
import com.roomly.api.user.service.UserPreferencesService;
import com.roomly.api.worktype.repository.WorkTypeRepository;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class OnboardingService {
  private final AuthenticatedUserAccessor authenticatedUserAccessor;
  private final UserProfileRepository profiles;
  private final UserPreferencesRepository preferences;
  private final UserPreferencesService userPreferencesService;
  private final HourlyRatePeriodRepository hourlyRates;
  private final WorkTypeRepository workTypes;

  @Transactional(readOnly = true)
  public OnboardingStatusResponse getStatus() {
    UUID userId = authenticatedUserAccessor.requireUserId();
    boolean profileConfigured = profiles.findByUserId(userId).map(this::isProfileConfigured).orElse(false);
    boolean preferencesConfigured = preferences.findByUserId(userId).isPresent();
    boolean hourlyRateConfigured = hourlyRates.existsByUserId(userId);
    boolean workTypeConfigured = workTypes.existsByUserIdAndActiveTrue(userId);
    boolean onboardingCompleted =
        preferences.findByUserId(userId).map(UserPreferences::isOnboardingCompleted).orElse(false);

    List<String> missingSteps = new ArrayList<>();
    if (!preferencesConfigured) {
      missingSteps.add("preferences");
    }
    if (!hourlyRateConfigured) {
      missingSteps.add("hourlyRate");
    }
    if (!workTypeConfigured) {
      missingSteps.add("workType");
    }

    return new OnboardingStatusResponse(
        profileConfigured,
        preferencesConfigured,
        hourlyRateConfigured,
        workTypeConfigured,
        onboardingCompleted,
        List.copyOf(missingSteps));
  }

  @Transactional
  public OnboardingStatusResponse complete() {
    OnboardingStatusResponse status = getStatus();
    if (!status.missingSteps().isEmpty()) {
      throw new ConflictException(
          "Onboarding cannot be completed until missing steps are resolved: "
              + String.join(", ", status.missingSteps()));
    }
    UserPreferences preferences = userPreferencesService.findCurrentPreferencesOrNull();
    if (preferences == null) {
      throw new ConflictException("Onboarding cannot be completed until preferences are configured");
    }
    if (!preferences.isOnboardingCompleted()) {
      userPreferencesService.completeOnboarding();
    }
    return getStatus();
  }

  private boolean isProfileConfigured(UserProfile profile) {
    return profile.getFirstName() != null
        || profile.getLastName() != null
        || profile.getDisplayName() != null
        || profile.getPhone() != null
        || profile.getCountryCode() != null
        || profile.getCity() != null
        || profile.getPostalCode() != null
        || profile.getStreet() != null
        || profile.getHouseNumber() != null
        || profile.getApartment() != null
        || profile.getAvatarUrl() != null
        || profile.getDateOfBirth() != null
        || profile.getEmploymentStartDate() != null
        || profile.getEmploymentEndDate() != null;
  }
}

package com.alveryn.api.onboarding.service;

import com.alveryn.api.auth.security.AuthenticatedUserAccessor;
import com.alveryn.api.common.exception.ConflictException;
import com.alveryn.api.onboarding.dto.OnboardingStatusResponse;
import com.alveryn.api.salary.repository.HourlyRatePeriodRepository;
import com.alveryn.api.user.entity.UserPreferences;
import com.alveryn.api.user.entity.UserProfile;
import com.alveryn.api.user.repository.UserPreferencesRepository;
import com.alveryn.api.user.repository.UserProfileRepository;
import com.alveryn.api.user.service.UserPreferencesService;
import com.alveryn.api.worktype.repository.WorkTypeRepository;
import com.alveryn.api.employment.entity.CompensationType;
import com.alveryn.api.employment.repository.EmploymentRepository;
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
  private final EmploymentRepository employments;

  @Transactional(readOnly = true)
  public OnboardingStatusResponse getStatus() {
    UUID userId = authenticatedUserAccessor.requireUserId();
    boolean profileConfigured =
        profiles.findByUserId(userId).map(this::hasRequiredProfileFields).orElse(false);
    boolean preferencesConfigured = preferences.findByUserId(userId).isPresent();
    boolean employmentConfigured = employments.existsByUserIdAndActiveTrue(userId);
    boolean hourlyRateRequired =
        employments.existsByUserIdAndActiveTrueAndCompensationType(userId, CompensationType.HOURLY);
    boolean hourlyRateConfigured = !hourlyRateRequired || hourlyRates.existsForActiveEarningsEmployment(userId);
    boolean workTypeConfigured = workTypes.existsByUserIdAndActiveTrue(userId);
    boolean onboardingCompleted =
        preferences.findByUserId(userId).map(UserPreferences::isOnboardingCompleted).orElse(false);

    List<String> missingSteps = new ArrayList<>();
    if (!profileConfigured) {
      missingSteps.add("profile");
    }
    if (!preferencesConfigured) {
      missingSteps.add("preferences");
    }
    if (!employmentConfigured) {
      missingSteps.add("employment");
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
        employmentConfigured,
        hourlyRateConfigured,
        workTypeConfigured,
        onboardingCompleted,
        List.copyOf(missingSteps));
  }

  @Transactional
  public OnboardingStatusResponse complete() {
    UUID userId = authenticatedUserAccessor.requireUserId();
    if (!profiles.findByUserId(userId).map(this::hasRequiredProfileFields).orElse(false)
        || !preferences.findByUserId(userId).isPresent()
        || !employments.existsByUserIdAndActiveTrue(userId)
        || !workTypes.existsByUserIdAndActiveTrue(userId)
        || (employments.existsByUserIdAndActiveTrueAndCompensationType(userId, CompensationType.HOURLY)
            && !hourlyRates.existsForActiveEarningsEmployment(userId))) {
      OnboardingStatusResponse status = getStatus();
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

  private boolean hasRequiredProfileFields(UserProfile profile) {
    return profile.getFirstName() != null
        && !profile.getFirstName().isBlank()
        && profile.getLastName() != null
        && !profile.getLastName().isBlank();
  }

}

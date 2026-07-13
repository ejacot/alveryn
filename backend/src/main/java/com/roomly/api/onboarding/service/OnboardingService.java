package com.roomly.api.onboarding.service;

import com.roomly.api.auth.security.AuthenticatedUserAccessor;
import com.roomly.api.common.exception.ConflictException;
import com.roomly.api.onboarding.dto.OnboardingStatusResponse;
import com.roomly.api.salary.repository.HourlyRatePeriodRepository;
import com.roomly.api.user.entity.UserAccount;
import com.roomly.api.user.entity.UserPreferences;
import com.roomly.api.user.entity.UserProfile;
import com.roomly.api.user.repository.UserAccountRepository;
import com.roomly.api.user.repository.UserPreferencesRepository;
import com.roomly.api.user.repository.UserProfileRepository;
import com.roomly.api.user.service.UserPreferencesService;
import com.roomly.api.worktype.entity.CalculationMethod;
import com.roomly.api.worktype.entity.WorkType;
import com.roomly.api.worktype.repository.WorkTypeRepository;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class OnboardingService {
  private static final String DEFAULT_WORK_TYPE_NAME = "Regular Shift";

  private final AuthenticatedUserAccessor authenticatedUserAccessor;
  private final UserAccountRepository users;
  private final UserProfileRepository profiles;
  private final UserPreferencesRepository preferences;
  private final UserPreferencesService userPreferencesService;
  private final HourlyRatePeriodRepository hourlyRates;
  private final WorkTypeRepository workTypes;

  @Transactional(readOnly = true)
  public OnboardingStatusResponse getStatus() {
    UUID userId = authenticatedUserAccessor.requireUserId();
    boolean profileConfigured =
        profiles.findByUserId(userId).map(this::hasRequiredProfileFields).orElse(false);
    boolean preferencesConfigured = preferences.findByUserId(userId).isPresent();
    boolean hourlyRateConfigured = hourlyRates.existsByUserId(userId);
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
    if (!hourlyRateConfigured) {
      missingSteps.add("hourlyRate");
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
    UUID userId = authenticatedUserAccessor.requireUserId();
    if (!profiles.findByUserId(userId).map(this::hasRequiredProfileFields).orElse(false)
        || !preferences.findByUserId(userId).isPresent()
        || !hourlyRates.existsByUserId(userId)) {
      OnboardingStatusResponse status = getStatus();
      throw new ConflictException(
          "Onboarding cannot be completed until missing steps are resolved: "
              + String.join(", ", status.missingSteps()));
    }
    ensureDefaultWorkType(userId);
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

  private void ensureDefaultWorkType(UUID userId) {
    if (workTypes.existsByUserIdAndActiveTrue(userId)) {
      return;
    }

    workTypes
        .findByUserIdAndNormalizedName(userId, normalize(DEFAULT_WORK_TYPE_NAME))
        .ifPresentOrElse(
            WorkType::activate,
            () -> {
              UserAccount user =
                  users.findById(userId).orElseThrow(() -> new ConflictException("User not found"));
              WorkType workType = new WorkType(user, DEFAULT_WORK_TYPE_NAME, CalculationMethod.TIME_BASED);
              workType.changeColor("#F4F4F5");
              workType.changeDefaultBreakMinutes(0);
              workType.changeDisplayOrder(0);
              workTypes.save(workType);
            });
  }

  private String normalize(String value) {
    return value.trim().toLowerCase(Locale.ROOT);
  }
}

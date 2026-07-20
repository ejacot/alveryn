package com.alveryn.api.onboarding.controller;

import com.alveryn.api.auth.security.AuthenticatedUserAccessor;
import com.alveryn.api.common.exception.ConflictException;
import com.alveryn.api.common.response.ApiResponse;
import com.alveryn.api.employment.repository.EmploymentRepository;
import com.alveryn.api.user.dto.UserPreferencesResponse;
import com.alveryn.api.user.service.UserPreferencesService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/tracking-setup")
@RequiredArgsConstructor
@Tag(name = "Tracking setup", description = "Versioned employment tracking setup")
public class TrackingSetupController {
  public static final int REQUIRED_VERSION = 1;

  private final AuthenticatedUserAccessor authenticatedUserAccessor;
  private final EmploymentRepository employments;
  private final UserPreferencesService preferencesService;

  @GetMapping("/current")
  @Operation(summary = "Get the required tracking setup version", security = @SecurityRequirement(name = "bearerAuth"))
  public ApiResponse<TrackingSetupStatusResponse> current() {
    UserPreferencesResponse preferences = preferencesService.get();
    return ApiResponse.of(status(preferences));
  }

  @PostMapping("/current/complete")
  @Operation(summary = "Complete the required tracking setup", security = @SecurityRequirement(name = "bearerAuth"))
  public ApiResponse<UserPreferencesResponse> complete() {
    if (!employments.existsByUserIdAndActiveTrue(authenticatedUserAccessor.requireUserId())) {
      throw new ConflictException("At least one active employment is required before completing tracking setup");
    }
    return ApiResponse.of(preferencesService.completeTrackingSetupVersion(REQUIRED_VERSION));
  }

  private TrackingSetupStatusResponse status(UserPreferencesResponse preferences) {
    return new TrackingSetupStatusResponse(
        REQUIRED_VERSION,
        preferences.trackingSetupVersionCompleted(),
        preferences.trackingSetupVersionCompleted() >= REQUIRED_VERSION);
  }

  public record TrackingSetupStatusResponse(int requiredVersion, int completedVersion, boolean completed) {}
}

package com.alveryn.api.onboarding.controller;

import com.alveryn.api.common.response.ApiResponse;
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
@RequestMapping("/api/guides")
@RequiredArgsConstructor
@Tag(name = "Guides", description = "Versioned in-app product guides")
public class GuideController {
  public static final int REQUIRED_GUIDE_VERSION = 2;

  private final UserPreferencesService preferencesService;

  @GetMapping("/current")
  @Operation(summary = "Get the currently required guide version", security = @SecurityRequirement(name = "bearerAuth"))
  public ApiResponse<GuideStatusResponse> current() {
    UserPreferencesResponse preferences = preferencesService.get();
    return ApiResponse.of(new GuideStatusResponse(
        REQUIRED_GUIDE_VERSION,
        preferences.guideVersionCompleted(),
        preferences.guideVersionCompleted() >= REQUIRED_GUIDE_VERSION));
  }

  @PostMapping("/current/complete")
  @Operation(summary = "Complete the currently required guide", security = @SecurityRequirement(name = "bearerAuth"))
  public ApiResponse<UserPreferencesResponse> complete() {
    return ApiResponse.of(preferencesService.completeGuideVersion(REQUIRED_GUIDE_VERSION));
  }

  public record GuideStatusResponse(int requiredVersion, int completedVersion, boolean completed) {}
}

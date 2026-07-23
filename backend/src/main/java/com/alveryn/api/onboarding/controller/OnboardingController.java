package com.alveryn.api.onboarding.controller;

import com.alveryn.api.common.response.ApiErrorResponse;
import com.alveryn.api.common.response.ApiResponse;
import com.alveryn.api.onboarding.dto.OnboardingStatusResponse;
import com.alveryn.api.onboarding.dto.InitialSetupRequest;
import com.alveryn.api.onboarding.dto.InitialSetupResponse;
import com.alveryn.api.onboarding.service.InitialSetupService;
import com.alveryn.api.onboarding.service.OnboardingService;
import jakarta.validation.Valid;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/onboarding")
@RequiredArgsConstructor
@Tag(name = "Onboarding", description = "Authenticated onboarding status endpoints")
public class OnboardingController {
  private final OnboardingService onboardingService;
  private final InitialSetupService initialSetupService;

  @GetMapping("/status")
  @Operation(
      summary = "Get onboarding status",
      description = "Returns the backend-calculated onboarding status for the authenticated user.",
      security = @SecurityRequirement(name = "bearerAuth"))
  @ApiResponses({
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "200",
        description = "Onboarding status returned successfully",
        content = @Content(schema = @Schema(implementation = OnboardingStatusApiResponse.class))),
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "401",
        description = "Authentication required",
        content = @Content(schema = @Schema(implementation = ApiErrorResponse.class)))
  })
  public ApiResponse<OnboardingStatusResponse> status() {
    return ApiResponse.of(onboardingService.getStatus());
  }

  @PostMapping("/complete")
  @Operation(
      summary = "Complete onboarding",
      description = "Idempotently marks onboarding complete only when the backend-calculated minimum setup requirements are satisfied.",
      security = @SecurityRequirement(name = "bearerAuth"))
  @ApiResponses({
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "200",
        description = "Onboarding completed or already complete",
        content = @Content(schema = @Schema(implementation = OnboardingStatusApiResponse.class))),
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "401",
        description = "Authentication required",
        content = @Content(schema = @Schema(implementation = ApiErrorResponse.class))),
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "409",
        description = "Required setup is still incomplete",
        content = @Content(schema = @Schema(implementation = ApiErrorResponse.class)))
  })
  public ApiResponse<OnboardingStatusResponse> complete() {
    return ApiResponse.of(onboardingService.complete());
  }

  @PostMapping("/initial-setup")
  @Operation(
      summary = "Complete the initial account setup atomically",
      description = "Creates the profile, preferences, first employment, rate when required, and first work type in one transaction.",
      security = @SecurityRequirement(name = "bearerAuth"))
  public ApiResponse<InitialSetupResponse> initialSetup(@Valid @org.springframework.web.bind.annotation.RequestBody InitialSetupRequest request) {
    return ApiResponse.of(initialSetupService.complete(request));
  }

  @Schema(name = "OnboardingStatusApiResponse", description = "Wrapped onboarding status response")
  public record OnboardingStatusApiResponse(OnboardingStatusResponse data) {}
}

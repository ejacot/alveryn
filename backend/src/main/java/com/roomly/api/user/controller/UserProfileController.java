package com.roomly.api.user.controller;

import com.roomly.api.common.response.ApiErrorResponse;
import com.roomly.api.common.response.ApiResponse;
import com.roomly.api.user.dto.UserProfileRequest;
import com.roomly.api.user.dto.UserProfileResponse;
import com.roomly.api.user.service.UserProfileService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/profile")
@RequiredArgsConstructor
@Tag(name = "Profile", description = "Authenticated user profile endpoints")
public class UserProfileController {
  private final UserProfileService userProfileService;

  @GetMapping
  @Operation(
      summary = "Get current profile",
      description = "Returns the current authenticated user's profile. A blank profile is created automatically when missing.",
      security = @SecurityRequirement(name = "bearerAuth"))
  @ApiResponses({
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "200",
        description = "Profile returned successfully",
        content = @Content(schema = @Schema(implementation = UserProfileApiResponse.class))),
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "401",
        description = "Authentication required",
        content = @Content(schema = @Schema(implementation = ApiErrorResponse.class)))
  })
  public ApiResponse<UserProfileResponse> get() {
    return ApiResponse.of(userProfileService.get());
  }

  @PutMapping
  @Operation(
      summary = "Update current profile",
      description = "Updates only the authenticated user's profile with normalized and validated values.",
      security = @SecurityRequirement(name = "bearerAuth"))
  @ApiResponses({
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "200",
        description = "Profile updated successfully",
        content = @Content(schema = @Schema(implementation = UserProfileApiResponse.class))),
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "400",
        description = "Validation failed",
        content = @Content(schema = @Schema(implementation = ApiErrorResponse.class))),
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "401",
        description = "Authentication required",
        content = @Content(schema = @Schema(implementation = ApiErrorResponse.class)))
  })
  public ApiResponse<UserProfileResponse> update(@Valid @RequestBody UserProfileRequest request) {
    return ApiResponse.of(userProfileService.update(request));
  }

  @Schema(name = "UserProfileApiResponse", description = "Wrapped user profile response")
  public record UserProfileApiResponse(UserProfileResponse data) {}
}

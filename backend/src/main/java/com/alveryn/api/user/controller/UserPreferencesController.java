package com.alveryn.api.user.controller;

import com.alveryn.api.common.response.ApiErrorResponse;
import com.alveryn.api.common.response.ApiResponse;
import com.alveryn.api.user.dto.UserPreferencesRequest;
import com.alveryn.api.user.dto.UserPreferencesResponse;
import com.alveryn.api.user.service.UserPreferencesService;
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
@RequestMapping("/api/preferences")
@RequiredArgsConstructor
@Tag(name = "Preferences", description = "Authenticated user preference endpoints")
public class UserPreferencesController {
  private final UserPreferencesService userPreferencesService;

  @GetMapping
  @Operation(
      summary = "Get current preferences",
      description = "Returns the current authenticated user's preferences. Default preferences are created automatically when missing.",
      security = @SecurityRequirement(name = "bearerAuth"))
  @ApiResponses({
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "200",
        description = "Preferences returned successfully",
        content = @Content(schema = @Schema(implementation = UserPreferencesApiResponse.class))),
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "401",
        description = "Authentication required",
        content = @Content(schema = @Schema(implementation = ApiErrorResponse.class)))
  })
  public ApiResponse<UserPreferencesResponse> get() {
    return ApiResponse.of(userPreferencesService.get());
  }

  @PutMapping
  @Operation(
      summary = "Update current preferences",
      description = "Updates only the authenticated user's general preferences. Onboarding completion is not accepted through this endpoint.",
      security = @SecurityRequirement(name = "bearerAuth"))
  @ApiResponses({
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "200",
        description = "Preferences updated successfully",
        content = @Content(schema = @Schema(implementation = UserPreferencesApiResponse.class))),
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "400",
        description = "Validation failed",
        content = @Content(schema = @Schema(implementation = ApiErrorResponse.class))),
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "401",
        description = "Authentication required",
        content = @Content(schema = @Schema(implementation = ApiErrorResponse.class)))
  })
  public ApiResponse<UserPreferencesResponse> update(
      @Valid @RequestBody UserPreferencesRequest request) {
    return ApiResponse.of(userPreferencesService.update(request));
  }

  @Schema(name = "UserPreferencesApiResponse", description = "Wrapped user preferences response")
  public record UserPreferencesApiResponse(UserPreferencesResponse data) {}
}

package com.roomly.api.auth.controller;

import com.roomly.api.auth.dto.CurrentUserResponse;
import com.roomly.api.auth.service.CurrentUserService;
import com.roomly.api.common.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@Tag(name = "User Profile", description = "Authenticated user profile and preference endpoints")
public class MeController {
  private final CurrentUserService currentUserService;

  @GetMapping("/api/me")
  @Operation(
      summary = "Get current user",
      description = "Returns the authenticated user account together with profile and preference data when available.",
      security = @SecurityRequirement(name = "bearerAuth"))
  @io.swagger.v3.oas.annotations.responses.ApiResponse(
      responseCode = "200",
      description = "Current user returned successfully",
      content = @Content(schema = @Schema(implementation = CurrentUserApiResponse.class)))
  public ApiResponse<CurrentUserResponse> me() {
    return ApiResponse.of(currentUserService.getCurrentUser());
  }

  @Schema(name = "CurrentUserApiResponse", description = "Wrapped current user response")
  public record CurrentUserApiResponse(CurrentUserResponse data) {}
}

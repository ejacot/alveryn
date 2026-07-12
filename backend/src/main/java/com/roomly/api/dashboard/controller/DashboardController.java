package com.roomly.api.dashboard.controller;

import com.roomly.api.common.response.ApiErrorResponse;
import com.roomly.api.common.response.ApiResponse;
import com.roomly.api.dashboard.dto.DashboardResponse;
import com.roomly.api.dashboard.service.DashboardService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@Tag(name = "Dashboard", description = "Authenticated dashboard summary endpoints")
public class DashboardController {
  private final DashboardService dashboardService;

  @GetMapping("/api/dashboard")
  @Operation(
      summary = "Get current month dashboard",
      description =
          "Returns the current month totals for worked hours, worked minutes, gross amount, entries count and absence days.",
      security = @SecurityRequirement(name = "bearerAuth"))
  @ApiResponses({
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "200",
        description = "Current month dashboard returned successfully",
        content = @Content(schema = @Schema(implementation = DashboardApiResponse.class))),
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "401",
        description = "Authentication required",
        content = @Content(schema = @Schema(implementation = ApiErrorResponse.class)))
  })
  public ApiResponse<DashboardResponse> dashboard() {
    return ApiResponse.of(dashboardService.getCurrentMonthDashboard());
  }

  @Schema(name = "DashboardApiResponse", description = "Wrapped dashboard response")
  public record DashboardApiResponse(DashboardResponse data) {}
}

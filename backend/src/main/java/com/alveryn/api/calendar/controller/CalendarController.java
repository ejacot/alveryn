package com.alveryn.api.calendar.controller;

import com.alveryn.api.calendar.dto.CalendarActivityRangeResponse;
import com.alveryn.api.calendar.service.CalendarActivityRangeService;
import com.alveryn.api.common.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/calendar")
@RequiredArgsConstructor
@Tag(name = "Calendar", description = "Authenticated calendar support endpoints")
public class CalendarController {
  private final CalendarActivityRangeService activityRangeService;

  @GetMapping("/activity-range")
  @Operation(
      summary = "Get calendar activity range",
      description =
          "Returns the earliest date with a work entry or absence for the authenticated user. Used by the calendar to mark days between the first activity and today.",
      security = @SecurityRequirement(name = "bearerAuth"))
  public ApiResponse<CalendarActivityRangeResponse> activityRange() {
    return ApiResponse.of(activityRangeService.getRange());
  }
}

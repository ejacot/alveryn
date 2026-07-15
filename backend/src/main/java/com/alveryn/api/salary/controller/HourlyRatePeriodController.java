package com.alveryn.api.salary.controller;

import com.alveryn.api.common.response.ApiErrorResponse;
import com.alveryn.api.common.response.ApiResponse;
import com.alveryn.api.salary.dto.HourlyRatePeriodRequest;
import com.alveryn.api.salary.dto.HourlyRatePeriodResponse;
import com.alveryn.api.salary.service.HourlyRatePeriodService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/hourly-rates")
@RequiredArgsConstructor
@Tag(name = "Hourly Rates", description = "Authenticated hourly rate period endpoints")
public class HourlyRatePeriodController {
  private final HourlyRatePeriodService hourlyRatePeriodService;

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  @Operation(
      summary = "Create an hourly rate period",
      description = "Creates a new hourly rate period for the authenticated user and rejects overlapping periods.",
      security = @SecurityRequirement(name = "bearerAuth"))
  @ApiResponses({
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "201",
        description = "Hourly rate period created",
        content = @Content(schema = @Schema(implementation = HourlyRateApiResponse.class))),
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "400",
        description = "Validation failed",
        content = @Content(schema = @Schema(implementation = ApiErrorResponse.class))),
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "401",
        description = "Authentication required",
        content = @Content(schema = @Schema(implementation = ApiErrorResponse.class))),
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "409",
        description = "Period overlaps an existing rate",
        content = @Content(schema = @Schema(implementation = ApiErrorResponse.class)))
  })
  public ApiResponse<HourlyRatePeriodResponse> create(
      @Valid @RequestBody HourlyRatePeriodRequest request) {
    return ApiResponse.of(hourlyRatePeriodService.create(request));
  }

  @GetMapping
  @Operation(
      summary = "List hourly rate periods",
      description = "Returns hourly rate periods for the authenticated user ordered by newest validFrom first.",
      security = @SecurityRequirement(name = "bearerAuth"))
  @ApiResponses({
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "200",
        description = "Hourly rate periods returned successfully",
        content = @Content(schema = @Schema(implementation = HourlyRateListApiResponse.class)))
  })
  public ApiResponse<List<HourlyRatePeriodResponse>> list() {
    return ApiResponse.of(hourlyRatePeriodService.list());
  }

  @GetMapping("/{id}")
  @Operation(
      summary = "Get an hourly rate period",
      description = "Returns one hourly rate period owned by the authenticated user.",
      security = @SecurityRequirement(name = "bearerAuth"))
  public ApiResponse<HourlyRatePeriodResponse> get(@PathVariable UUID id) {
    return ApiResponse.of(hourlyRatePeriodService.get(id));
  }

  @PutMapping("/{id}")
  @Operation(
      summary = "Update an hourly rate period",
      description = "Updates one hourly rate period owned by the authenticated user while enforcing non-overlapping validity ranges.",
      security = @SecurityRequirement(name = "bearerAuth"))
  public ApiResponse<HourlyRatePeriodResponse> update(
      @PathVariable UUID id, @Valid @RequestBody HourlyRatePeriodRequest request) {
    return ApiResponse.of(hourlyRatePeriodService.update(id, request));
  }

  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @Operation(
      summary = "Delete an hourly rate period",
      description = "Deletes one hourly rate period owned by the authenticated user.",
      security = @SecurityRequirement(name = "bearerAuth"))
  public void delete(@PathVariable UUID id) {
    hourlyRatePeriodService.delete(id);
  }

  @Schema(name = "HourlyRateApiResponse", description = "Wrapped hourly rate period response")
  public record HourlyRateApiResponse(HourlyRatePeriodResponse data) {}

  @Schema(name = "HourlyRateListApiResponse", description = "Wrapped hourly rate period list response")
  public record HourlyRateListApiResponse(List<HourlyRatePeriodResponse> data) {}
}

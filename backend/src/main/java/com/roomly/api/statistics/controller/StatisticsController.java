package com.roomly.api.statistics.controller;

import com.roomly.api.common.response.ApiResponse;
import com.roomly.api.statistics.dto.StatisticsFilters;
import com.roomly.api.statistics.dto.StatisticsMetric;
import com.roomly.api.statistics.dto.StatisticsOverviewResponse;
import com.roomly.api.statistics.dto.StatisticsTimeSeriesResponse;
import com.roomly.api.statistics.dto.StatisticsWorkTypeResponse;
import com.roomly.api.statistics.service.StatisticsService;
import com.roomly.api.worktype.entity.CalculationMethod;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/statistics")
@RequiredArgsConstructor
@Tag(name = "Statistics", description = "Authenticated aggregated work statistics")
public class StatisticsController {
  private final StatisticsService statisticsService;

  @GetMapping("/overview")
  @Operation(summary = "Return statistics overview", security = @SecurityRequirement(name = "bearerAuth"))
  public ApiResponse<StatisticsOverviewResponse> overview(
      @RequestParam(required = false) LocalDate from,
      @RequestParam(required = false) LocalDate to,
      @RequestParam(required = false) List<UUID> workTypeIds,
      @RequestParam(required = false) List<CalculationMethod> calculationMethods) {
    return ApiResponse.of(
        statisticsService.overview(new StatisticsFilters(from, to, workTypeIds, calculationMethods)));
  }

  @GetMapping("/timeseries")
  @Operation(summary = "Return statistics time series", security = @SecurityRequirement(name = "bearerAuth"))
  public ApiResponse<StatisticsTimeSeriesResponse> timeSeries(
      @RequestParam(required = false) LocalDate from,
      @RequestParam(required = false) LocalDate to,
      @Parameter(description = "Metric to aggregate", example = "GROSS")
          @RequestParam(defaultValue = "GROSS")
          StatisticsMetric metric,
      @RequestParam(required = false) List<UUID> workTypeIds,
      @RequestParam(required = false) List<CalculationMethod> calculationMethods) {
    return ApiResponse.of(
        statisticsService.timeSeries(new StatisticsFilters(from, to, workTypeIds, calculationMethods), metric));
  }

  @GetMapping("/work-types")
  @Operation(summary = "Return statistics work type breakdown", security = @SecurityRequirement(name = "bearerAuth"))
  public ApiResponse<List<StatisticsWorkTypeResponse>> workTypes(
      @RequestParam(required = false) LocalDate from,
      @RequestParam(required = false) LocalDate to,
      @RequestParam(required = false) List<UUID> workTypeIds,
      @RequestParam(required = false) List<CalculationMethod> calculationMethods) {
    return ApiResponse.of(
        statisticsService.workTypes(new StatisticsFilters(from, to, workTypeIds, calculationMethods)));
  }
}

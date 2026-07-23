package com.alveryn.api.schedule.controller;

import com.alveryn.api.common.response.ApiResponse;
import com.alveryn.api.schedule.dto.*;
import com.alveryn.api.schedule.service.ScheduleService;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/employments/{employmentId}/schedule")
@RequiredArgsConstructor
public class ScheduleController {
  private final ScheduleService service;

  @GetMapping
  public ApiResponse<WeeklyScheduleResponse> current(@PathVariable UUID employmentId) {
    return ApiResponse.of(service.current(employmentId));
  }

  @PutMapping
  public ApiResponse<WeeklyScheduleResponse> replace(@PathVariable UUID employmentId,
      @Valid @RequestBody WeeklyScheduleRequest request) {
    return ApiResponse.of(service.replace(employmentId, request));
  }

  @GetMapping("/shifts")
  public ApiResponse<List<ScheduledShiftResponse>> shifts(@PathVariable UUID employmentId,
      @RequestParam LocalDate from, @RequestParam LocalDate to) {
    return ApiResponse.of(service.range(employmentId, from, to));
  }

  @PutMapping("/shifts/{assignmentId}")
  public ApiResponse<ScheduledShiftResponse> override(@PathVariable UUID employmentId,
      @PathVariable UUID assignmentId, @Valid @RequestBody ShiftOverrideRequest request) {
    return ApiResponse.of(service.override(employmentId, assignmentId, request));
  }
}

package com.alveryn.api.schedule.controller;
import com.alveryn.api.common.response.ApiResponse;
import com.alveryn.api.schedule.dto.*;
import com.alveryn.api.schedule.service.BusinessScheduleService;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/organizations/{organizationId}/shifts") @RequiredArgsConstructor
public class BusinessScheduleController {
  private final BusinessScheduleService service;
  @GetMapping public ApiResponse<List<BusinessShiftResponse>> range(@PathVariable UUID organizationId,
      @RequestParam LocalDate from, @RequestParam LocalDate to) {
    return ApiResponse.of(service.range(organizationId, from, to));
  }
  @PostMapping @ResponseStatus(HttpStatus.CREATED)
  public ApiResponse<BusinessShiftResponse> create(@PathVariable UUID organizationId,
      @Valid @RequestBody BusinessShiftRequest request) {
    return ApiResponse.of(service.create(organizationId, request));
  }
  @PutMapping("/{assignmentId}")
  public ApiResponse<BusinessShiftResponse> update(@PathVariable UUID organizationId,
      @PathVariable UUID assignmentId, @Valid @RequestBody BusinessShiftRequest request) {
    return ApiResponse.of(service.update(organizationId, assignmentId, request));
  }
  @DeleteMapping("/{assignmentId}") @ResponseStatus(HttpStatus.NO_CONTENT)
  public void cancel(@PathVariable UUID organizationId, @PathVariable UUID assignmentId) {
    service.cancel(organizationId, assignmentId);
  }
}

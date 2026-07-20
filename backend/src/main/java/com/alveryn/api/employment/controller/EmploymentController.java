package com.alveryn.api.employment.controller;

import com.alveryn.api.common.response.ApiResponse;
import com.alveryn.api.employment.dto.*;
import com.alveryn.api.employment.service.EmploymentService;
import jakarta.validation.Valid;
import java.util.*;
import java.time.YearMonth;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/employments") @RequiredArgsConstructor
public class EmploymentController {
  private final EmploymentService service;
  @GetMapping public ApiResponse<List<EmploymentResponse>> list() { return ApiResponse.of(service.list()); }
  @GetMapping("/{id}") public ApiResponse<EmploymentResponse> get(@PathVariable UUID id) { return ApiResponse.of(service.get(id)); }
  @GetMapping("/{id}/hour-balance") public ApiResponse<EmploymentHourBalanceResponse> hourBalance(@PathVariable UUID id, @RequestParam int year, @RequestParam int month) { return ApiResponse.of(service.hourBalance(id, YearMonth.of(year, month))); }
  @PostMapping @ResponseStatus(HttpStatus.CREATED) public ApiResponse<EmploymentResponse> create(@Valid @RequestBody EmploymentRequest request) { return ApiResponse.of(service.create(request)); }
  @PutMapping("/{id}") public ApiResponse<EmploymentResponse> update(@PathVariable UUID id, @Valid @RequestBody EmploymentRequest request) { return ApiResponse.of(service.update(id, request)); }
  @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) public void delete(@PathVariable UUID id) { service.delete(id); }
}

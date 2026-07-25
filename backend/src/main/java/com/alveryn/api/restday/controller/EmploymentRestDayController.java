package com.alveryn.api.restday.controller;

import com.alveryn.api.common.response.ApiResponse;
import com.alveryn.api.restday.dto.RestDayRequest;
import com.alveryn.api.restday.dto.RestDayResponse;
import com.alveryn.api.restday.service.EmploymentRestDayService;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/employments/{employmentId}/rest-days")
@RequiredArgsConstructor
public class EmploymentRestDayController {
  private final EmploymentRestDayService service;

  @GetMapping
  public ApiResponse<List<RestDayResponse>> range(
      @PathVariable UUID employmentId,
      @RequestParam LocalDate from,
      @RequestParam LocalDate to) {
    return ApiResponse.of(service.range(employmentId, from, to));
  }

  @PutMapping("/{date}")
  public ApiResponse<RestDayResponse> mark(
      @PathVariable UUID employmentId,
      @PathVariable LocalDate date,
      @Valid @RequestBody RestDayRequest request) {
    return ApiResponse.of(service.mark(employmentId, date, request));
  }

  @DeleteMapping("/{date}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void remove(@PathVariable UUID employmentId, @PathVariable LocalDate date) {
    service.remove(employmentId, date);
  }
}

package com.alveryn.api.worksession.controller;

import com.alveryn.api.common.response.ApiResponse;
import com.alveryn.api.worksession.dto.*;
import com.alveryn.api.worksession.service.WorkSessionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping({"/api/work-intervals", "/api/work-sessions"}) @RequiredArgsConstructor
public class WorkSessionController {
  private final WorkSessionService service;
  @GetMapping("/current") public ApiResponse<WorkSessionResponse> current() { return ApiResponse.of(service.current()); }
  @PostMapping("/check-in") @ResponseStatus(HttpStatus.CREATED) public ApiResponse<WorkSessionResponse> checkIn(@Valid @RequestBody WorkSessionRequest request) { return ApiResponse.of(service.checkIn(request)); }
  @PostMapping("/check-out") public ApiResponse<WorkSessionResponse> checkOut(@Valid @RequestBody WorkSessionCheckoutRequest request) { return ApiResponse.of(service.checkOut(request)); }
  @PostMapping("/pause/start") public ApiResponse<WorkSessionResponse> startPause() { return ApiResponse.of(service.startPause()); }
  @PostMapping("/pause/end") public ApiResponse<WorkSessionResponse> endPause() { return ApiResponse.of(service.endPause()); }
  @DeleteMapping("/current") @ResponseStatus(HttpStatus.NO_CONTENT) public void cancel() { service.cancel(); }
}

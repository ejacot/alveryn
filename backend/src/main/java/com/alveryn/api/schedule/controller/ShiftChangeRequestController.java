package com.alveryn.api.schedule.controller;
import com.alveryn.api.common.response.ApiResponse;
import com.alveryn.api.schedule.dto.*;
import com.alveryn.api.schedule.service.ShiftChangeRequestService;
import jakarta.validation.Valid;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/organizations/{organizationId}/shift-requests") @RequiredArgsConstructor
public class ShiftChangeRequestController {
  private final ShiftChangeRequestService service;
  @GetMapping public ApiResponse<List<ShiftChangeRequestResponse>> list(@PathVariable UUID organizationId){
    return ApiResponse.of(service.list(organizationId));
  }
  @PostMapping("/assignments/{assignmentId}") @ResponseStatus(HttpStatus.CREATED)
  public ApiResponse<ShiftChangeRequestResponse> create(@PathVariable UUID organizationId,
      @PathVariable UUID assignmentId,@Valid @RequestBody ShiftChangeRequestPayload payload){
    return ApiResponse.of(service.create(organizationId,assignmentId,payload));
  }
  @PutMapping("/{requestId}/decision")
  public ApiResponse<ShiftChangeRequestResponse> decide(@PathVariable UUID organizationId,
      @PathVariable UUID requestId,@RequestBody ShiftChangeDecisionRequest decision){
    return ApiResponse.of(service.decide(organizationId,requestId,decision.approved()));
  }
  @DeleteMapping("/{requestId}") @ResponseStatus(HttpStatus.NO_CONTENT)
  public void cancel(@PathVariable UUID organizationId,@PathVariable UUID requestId){
    service.cancel(organizationId,requestId);
  }
}

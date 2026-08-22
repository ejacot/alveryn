package com.alveryn.api.organization.controller;

import com.alveryn.api.common.response.ApiResponse;
import com.alveryn.api.organization.dto.BusinessInvitationResponse;
import com.alveryn.api.organization.service.BusinessInvitationService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/business-invitations")
@RequiredArgsConstructor
public class BusinessInvitationController {
  private final BusinessInvitationService service;
  @GetMapping("/{token}") public ApiResponse<BusinessInvitationResponse> get(@PathVariable String token) {
    return ApiResponse.of(service.get(token));
  }
  @PostMapping("/{token}/accept") public ApiResponse<BusinessInvitationResponse> accept(@PathVariable String token) {
    return ApiResponse.of(service.accept(token));
  }
  @PostMapping("/{token}/decline") public ApiResponse<BusinessInvitationResponse> decline(@PathVariable String token) {
    return ApiResponse.of(service.decline(token));
  }
}

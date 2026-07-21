package com.alveryn.api.admin.controller;

import com.alveryn.api.admin.dto.AdminDashboardResponse;
import com.alveryn.api.admin.service.AdminDashboardService;
import com.alveryn.api.common.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminDashboardController {
  private final AdminDashboardService service;

  @GetMapping("/dashboard")
  public ApiResponse<AdminDashboardResponse> dashboard() {
    return ApiResponse.of(service.dashboard());
  }
}

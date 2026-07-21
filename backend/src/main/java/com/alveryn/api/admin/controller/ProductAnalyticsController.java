package com.alveryn.api.admin.controller;

import com.alveryn.api.admin.service.ProductAnalyticsService;
import com.alveryn.api.auth.dto.GenericSuccessResponse;
import com.alveryn.api.auth.security.AuthenticatedUserAccessor;
import com.alveryn.api.common.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/analytics")
@RequiredArgsConstructor
public class ProductAnalyticsController {
  private final ProductAnalyticsService analytics;
  private final AuthenticatedUserAccessor authenticated;

  @PostMapping("/pdf-export")
  @ResponseStatus(HttpStatus.CREATED)
  public ApiResponse<GenericSuccessResponse> pdfExported() {
    analytics.recordPdfExport(authenticated.requireUserId());
    return ApiResponse.of(new GenericSuccessResponse("Event recorded"));
  }
}

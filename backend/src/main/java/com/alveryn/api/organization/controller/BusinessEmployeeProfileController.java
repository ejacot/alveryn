package com.alveryn.api.organization.controller;

import com.alveryn.api.common.response.ApiResponse;
import com.alveryn.api.organization.dto.BusinessEmployeeTerms.*;
import com.alveryn.api.organization.service.BusinessEmployeeProfileService;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/organizations/{organizationId}/members/{membershipId}/profile")
public class BusinessEmployeeProfileController {
  private final BusinessEmployeeProfileService service;

  @GetMapping
  public ApiResponse<Profile> get(@PathVariable UUID organizationId, @PathVariable UUID membershipId,
      @RequestParam LocalDate from, @RequestParam LocalDate to) {
    return ApiResponse.of(service.get(organizationId, membershipId, from, to));
  }

  @PostMapping("/terms")
  @ResponseStatus(HttpStatus.CREATED)
  public ApiResponse<Term> add(@PathVariable UUID organizationId, @PathVariable UUID membershipId,
      @Valid @RequestBody Input input) {
    return ApiResponse.of(service.add(organizationId, membershipId, input));
  }
}

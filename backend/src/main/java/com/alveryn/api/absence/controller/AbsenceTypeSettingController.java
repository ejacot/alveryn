package com.alveryn.api.absence.controller;

import com.alveryn.api.absence.dto.AbsenceTypeSettingRequest;
import com.alveryn.api.absence.dto.AbsenceTypeSettingResponse;
import com.alveryn.api.absence.service.AbsenceTypeSettingService;
import com.alveryn.api.common.response.ApiResponse;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/absence-types")
@RequiredArgsConstructor
public class AbsenceTypeSettingController {
  private final AbsenceTypeSettingService service;

  @GetMapping
  public ApiResponse<List<AbsenceTypeSettingResponse>> list(
      @RequestParam(defaultValue = "true") boolean activeOnly) {
    return ApiResponse.of(service.list(activeOnly));
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public ApiResponse<AbsenceTypeSettingResponse> create(
      @Valid @RequestBody AbsenceTypeSettingRequest request) {
    return ApiResponse.of(service.create(request));
  }

  @PutMapping("/{id}")
  public ApiResponse<AbsenceTypeSettingResponse> update(
      @PathVariable UUID id, @Valid @RequestBody AbsenceTypeSettingRequest request) {
    return ApiResponse.of(service.update(id, request));
  }

  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void delete(@PathVariable UUID id) {
    service.deactivate(id);
  }
}

package com.alveryn.api.workrecord.controller;

import com.alveryn.api.common.response.ApiErrorResponse;
import com.alveryn.api.common.response.ApiResponse;
import com.alveryn.api.workrecord.dto.WorkRecordRequest;
import com.alveryn.api.workrecord.dto.WorkRecordResponse;
import com.alveryn.api.workrecord.service.WorkRecordService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
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

@Validated
@RestController
@RequestMapping("/api/work-records")
@RequiredArgsConstructor
@Tag(name = "Work Records", description = "Grouped work records containing one or more calculated work lines")
public class WorkRecordController {
  private final WorkRecordService workRecordService;

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  @Operation(
      summary = "Create a grouped work record",
      description =
          "Creates one work record for a local work date and persists each line through the work record line calculation engine.",
      security = @SecurityRequirement(name = "bearerAuth"))
  @io.swagger.v3.oas.annotations.responses.ApiResponses({
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "201",
        description = "Work record created",
        content = @Content(schema = @Schema(implementation = WorkRecordApiResponse.class))),
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "400",
        description = "Validation failed",
        content = @Content(schema = @Schema(implementation = ApiErrorResponse.class))),
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "401",
        description = "Authentication required",
        content = @Content(schema = @Schema(implementation = ApiErrorResponse.class)))
  })
  public ApiResponse<WorkRecordResponse> create(@Valid @RequestBody WorkRecordRequest request) {
    return ApiResponse.of(workRecordService.create(request));
  }

  @PostMapping("/sessions")
  @ResponseStatus(HttpStatus.CREATED)
  @Operation(summary = "Create a one-day work session")
  public ApiResponse<WorkRecordResponse> createSession(@Valid @RequestBody WorkRecordRequest request) {
    return ApiResponse.of(workRecordService.createSession(request));
  }

  @GetMapping("/{id}")
  @Operation(
      summary = "Get a work record",
      description = "Returns one grouped work record owned by the authenticated user.",
      security = @SecurityRequirement(name = "bearerAuth"))
  public ApiResponse<WorkRecordResponse> get(@PathVariable UUID id) {
    return ApiResponse.of(workRecordService.get(id));
  }

  @PutMapping("/{id}")
  @Operation(
      summary = "Update a work record",
      description = "Updates the grouped work record and replaces its calculated work lines transactionally.",
      security = @SecurityRequirement(name = "bearerAuth"))
  public ApiResponse<WorkRecordResponse> update(
      @PathVariable UUID id, @Valid @RequestBody WorkRecordRequest request) {
    return ApiResponse.of(workRecordService.update(id, request));
  }

  @PutMapping("/{id}/session")
  @Operation(summary = "Update a work session")
  public ApiResponse<WorkRecordResponse> updateSession(
      @PathVariable UUID id, @Valid @RequestBody WorkRecordRequest request) {
    return ApiResponse.of(workRecordService.updateSession(id, request));
  }

  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @Operation(
      summary = "Delete a work record",
      description = "Deletes one grouped work record and its calculated work lines.",
      security = @SecurityRequirement(name = "bearerAuth"))
  public void delete(@PathVariable UUID id) {
    workRecordService.delete(id);
  }

  @GetMapping("/day")
  @Operation(
      summary = "List work records for one local date",
      description = "Returns grouped work records for exactly one authenticated user's local work date.",
      security = @SecurityRequirement(name = "bearerAuth"))
  public ApiResponse<List<WorkRecordResponse>> day(@RequestParam LocalDate date) {
    return ApiResponse.of(workRecordService.listDay(date));
  }

  @GetMapping("/range")
  @Operation(
      summary = "List work records for a local date range",
      description = "Returns grouped work records for the authenticated user between two inclusive local dates.",
      security = @SecurityRequirement(name = "bearerAuth"))
  public ApiResponse<List<WorkRecordResponse>> range(
      @RequestParam LocalDate from, @RequestParam LocalDate to) {
    return ApiResponse.of(workRecordService.listRange(from, to));
  }

  @Schema(name = "WorkRecordApiResponse", description = "Wrapped work record response")
  public record WorkRecordApiResponse(WorkRecordResponse data) {}
}

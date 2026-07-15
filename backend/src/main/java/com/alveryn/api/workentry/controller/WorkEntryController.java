package com.alveryn.api.workentry.controller;

import com.alveryn.api.common.response.ApiErrorResponse;
import com.alveryn.api.common.response.ApiResponse;
import com.alveryn.api.common.response.PageResponse;
import com.alveryn.api.workentry.dto.WorkEntryRequest;
import com.alveryn.api.workentry.dto.WorkEntryResponse;
import com.alveryn.api.workentry.service.WorkEntryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.data.web.SortDefault;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.validation.annotation.Validated;

@Validated
@RestController
@RequestMapping("/api/work-entries")
@RequiredArgsConstructor
@Tag(name = "Work Entries", description = "Authenticated work tracking CRUD endpoints")
public class WorkEntryController {
  private static final int MAX_PAGE_SIZE = 100;

  private final WorkEntryService workEntryService;

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  @Operation(
      summary = "Create a work entry",
      description =
          "Creates a TIME_BASED or UNIT_BASED work entry for the authenticated user. Validation rules depend on the selected work type.",
      security = @SecurityRequirement(name = "bearerAuth"))
  @io.swagger.v3.oas.annotations.responses.ApiResponses({
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "201",
        description = "Work entry created",
        content = @Content(schema = @Schema(implementation = WorkEntryApiResponse.class))),
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "400",
        description = "Validation failed",
        content = @Content(schema = @Schema(implementation = ApiErrorResponse.class))),
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "401",
        description = "Authentication required",
        content = @Content(schema = @Schema(implementation = ApiErrorResponse.class)))
  })
  public ApiResponse<WorkEntryResponse> create(@Valid @RequestBody WorkEntryRequest request) {
    return ApiResponse.of(workEntryService.create(request));
  }

  @GetMapping
  @Operation(
      summary = "List work entries",
      description =
          "Returns a stable paginated response for the authenticated user. Supports filtering by year, month and work type. Page size must be between 1 and 100.",
      security = @SecurityRequirement(name = "bearerAuth"))
  @io.swagger.v3.oas.annotations.responses.ApiResponse(
      responseCode = "200",
      description = "Work entries returned successfully",
      content = @Content(schema = @Schema(implementation = WorkEntryPageApiResponse.class)))
  public ApiResponse<PageResponse<WorkEntryResponse>> list(
      @Parameter(description = "Filter by year. Required when month is provided.", example = "2026")
          @RequestParam(required = false)
          @Min(1900)
          Integer year,
      @Parameter(description = "Filter by month from 1 to 12.", example = "7")
          @RequestParam(required = false)
          @Min(1)
          @Max(12)
          Integer month,
      @Parameter(description = "Filter by work type id")
          @RequestParam(required = false)
          UUID workTypeId,
      @Parameter(description = "Zero-based page index", example = "0")
          @RequestParam(required = false, defaultValue = "0")
          @Min(0)
          Integer page,
      @Parameter(description = "Page size between 1 and 100", example = "20")
          @RequestParam(required = false, defaultValue = "20")
          @Min(1)
          @Max(MAX_PAGE_SIZE)
          Integer size,
      @PageableDefault(size = 20)
          @SortDefault.SortDefaults({
            @SortDefault(sort = "workDate", direction = org.springframework.data.domain.Sort.Direction.DESC),
            @SortDefault(sort = "createdAt", direction = org.springframework.data.domain.Sort.Direction.DESC)
          })
          Pageable pageable) {
    Page<WorkEntryResponse> entries = workEntryService.list(year, month, workTypeId, pageable);
    return ApiResponse.of(PageResponse.from(entries));
  }

  @GetMapping("/day")
  @Operation(
      summary = "List work entries for one local date",
      description = "Returns all work entries for exactly one authenticated user's local work date.",
      security = @SecurityRequirement(name = "bearerAuth"))
  public ApiResponse<List<WorkEntryResponse>> day(
      @Parameter(description = "Local work date", example = "2026-07-14")
          @RequestParam
          LocalDate date) {
    return ApiResponse.of(workEntryService.listDay(date));
  }

  @GetMapping("/recent")
  @Operation(
      summary = "List recent work entries",
      description = "Returns the authenticated user's latest work entries globally, sorted by work date and creation time.",
      security = @SecurityRequirement(name = "bearerAuth"))
  public ApiResponse<List<WorkEntryResponse>> recent(
      @Parameter(description = "Maximum number of entries to return", example = "5")
          @RequestParam(defaultValue = "5")
          @Min(1)
          @Max(20)
          Integer limit) {
    return ApiResponse.of(workEntryService.listRecent(limit));
  }

  @GetMapping("/{id}")
  @Operation(
      summary = "Get a work entry",
      description = "Returns one work entry owned by the authenticated user.",
      security = @SecurityRequirement(name = "bearerAuth"))
  @io.swagger.v3.oas.annotations.responses.ApiResponse(
      responseCode = "200",
      description = "Work entry returned successfully",
      content = @Content(schema = @Schema(implementation = WorkEntryApiResponse.class)))
  public ApiResponse<WorkEntryResponse> get(@PathVariable UUID id) {
    return ApiResponse.of(workEntryService.get(id));
  }

  @PutMapping("/{id}")
  @Operation(
      summary = "Update a work entry",
      description = "Recalculates the selected work entry using the submitted payload and the historical salary valid on the work date.",
      security = @SecurityRequirement(name = "bearerAuth"))
  @io.swagger.v3.oas.annotations.responses.ApiResponse(
      responseCode = "200",
      description = "Work entry updated successfully",
      content = @Content(schema = @Schema(implementation = WorkEntryApiResponse.class)))
  public ApiResponse<WorkEntryResponse> update(
      @PathVariable UUID id, @Valid @RequestBody WorkEntryRequest request) {
    return ApiResponse.of(workEntryService.update(id, request));
  }

  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @Operation(
      summary = "Delete a work entry",
      description = "Deletes a work entry owned by the authenticated user.",
      security = @SecurityRequirement(name = "bearerAuth"))
  public void delete(@PathVariable UUID id) {
    workEntryService.delete(id);
  }

  @Schema(name = "WorkEntryApiResponse", description = "Wrapped work entry response")
  public record WorkEntryApiResponse(WorkEntryResponse data) {}

  @Schema(name = "WorkEntryPageApiResponse", description = "Wrapped paginated work entry response")
  public record WorkEntryPageApiResponse(PageResponse<WorkEntryResponse> data) {}
}

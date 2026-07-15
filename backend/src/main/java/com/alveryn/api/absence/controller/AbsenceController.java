package com.alveryn.api.absence.controller;

import com.alveryn.api.absence.dto.AbsenceRequest;
import com.alveryn.api.absence.dto.AbsenceResponse;
import com.alveryn.api.absence.entity.AbsenceType;
import com.alveryn.api.absence.service.AbsenceService;
import com.alveryn.api.common.response.ApiErrorResponse;
import com.alveryn.api.common.response.ApiResponse;
import com.alveryn.api.common.response.PageResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.data.web.SortDefault;
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
@RequestMapping("/api/absences")
@RequiredArgsConstructor
@Tag(name = "Absences", description = "Authenticated absence configuration endpoints")
public class AbsenceController {
  private static final int MAX_PAGE_SIZE = 100;

  private final AbsenceService absenceService;

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  @Operation(
      summary = "Create an absence",
      description = "Creates an absence for the authenticated user and rejects overlaps with absences or work entries.",
      security = @SecurityRequirement(name = "bearerAuth"))
  @ApiResponses({
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "201",
        description = "Absence created",
        content = @Content(schema = @Schema(implementation = AbsenceApiResponse.class))),
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "400",
        description = "Validation failed",
        content = @Content(schema = @Schema(implementation = ApiErrorResponse.class))),
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "401",
        description = "Authentication required",
        content = @Content(schema = @Schema(implementation = ApiErrorResponse.class))),
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "409",
        description = "Conflict with existing absences or work entries",
        content = @Content(schema = @Schema(implementation = ApiErrorResponse.class)))
  })
  public ApiResponse<AbsenceResponse> create(@Valid @RequestBody AbsenceRequest request) {
    return ApiResponse.of(absenceService.create(request));
  }

  @GetMapping
  @Operation(
      summary = "List absences",
      description =
          "Returns a stable paginated response for the authenticated user. Supports year/month or from/to filtering, plus absenceType. year/month cannot be combined with from/to.",
      security = @SecurityRequirement(name = "bearerAuth"))
  public ApiResponse<PageResponse<AbsenceResponse>> list(
      @Parameter(example = "2026") @RequestParam(required = false) @Min(1900) Integer year,
      @Parameter(example = "7") @RequestParam(required = false) @Min(1) @Max(12) Integer month,
      @RequestParam(required = false) LocalDate from,
      @RequestParam(required = false) LocalDate to,
      @RequestParam(required = false) AbsenceType absenceType,
      @RequestParam(required = false, defaultValue = "0") @Min(0) Integer page,
      @RequestParam(required = false, defaultValue = "20") @Min(1) @Max(MAX_PAGE_SIZE) Integer size,
      @PageableDefault(size = 20)
          @SortDefault.SortDefaults({
            @SortDefault(sort = "startDate", direction = org.springframework.data.domain.Sort.Direction.DESC),
            @SortDefault(sort = "createdAt", direction = org.springframework.data.domain.Sort.Direction.DESC)
          })
          Pageable pageable) {
    return ApiResponse.of(
        PageResponse.from(absenceService.list(year, month, from, to, absenceType, pageable)));
  }

  @GetMapping("/{id}")
  @Operation(
      summary = "Get an absence",
      description = "Returns one absence owned by the authenticated user.",
      security = @SecurityRequirement(name = "bearerAuth"))
  public ApiResponse<AbsenceResponse> get(@PathVariable UUID id) {
    return ApiResponse.of(absenceService.get(id));
  }

  @PutMapping("/{id}")
  @Operation(
      summary = "Update an absence",
      description = "Updates one absence owned by the authenticated user while enforcing range and work entry conflict rules.",
      security = @SecurityRequirement(name = "bearerAuth"))
  public ApiResponse<AbsenceResponse> update(
      @PathVariable UUID id, @Valid @RequestBody AbsenceRequest request) {
    return ApiResponse.of(absenceService.update(id, request));
  }

  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @Operation(
      summary = "Delete an absence",
      description = "Deletes one absence owned by the authenticated user.",
      security = @SecurityRequirement(name = "bearerAuth"))
  public void delete(@PathVariable UUID id) {
    absenceService.delete(id);
  }

  @Schema(name = "AbsenceApiResponse", description = "Wrapped absence response")
  public record AbsenceApiResponse(AbsenceResponse data) {}

  @Schema(name = "AbsencePageApiResponse", description = "Wrapped paginated absence response")
  public record AbsencePageApiResponse(PageResponse<AbsenceResponse> data) {}
}

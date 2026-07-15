package com.alveryn.api.worktype.controller;

import com.alveryn.api.common.response.ApiErrorResponse;
import com.alveryn.api.common.response.ApiResponse;
import com.alveryn.api.worktype.dto.UnitTypeRequest;
import com.alveryn.api.worktype.dto.UnitTypeResponse;
import com.alveryn.api.worktype.service.UnitTypeService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
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
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/work-types/{workTypeId}/unit-types")
@RequiredArgsConstructor
@Tag(name = "Unit Types", description = "Authenticated unit type configuration endpoints")
public class UnitTypeController {
  private final UnitTypeService unitTypeService;

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  @Operation(
      summary = "Create a unit type",
      description = "Creates a unit type under an owned UNIT_BASED work type.",
      security = @SecurityRequirement(name = "bearerAuth"))
  @ApiResponses({
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "201",
        description = "Unit type created",
        content = @Content(schema = @Schema(implementation = UnitTypeApiResponse.class))),
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "400",
        description = "Validation failed",
        content = @Content(schema = @Schema(implementation = ApiErrorResponse.class))),
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "401",
        description = "Authentication required",
        content = @Content(schema = @Schema(implementation = ApiErrorResponse.class))),
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "404",
        description = "Parent work type not found for current user",
        content = @Content(schema = @Schema(implementation = ApiErrorResponse.class))),
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "409",
        description = "Conflict with parent state or duplicate name",
        content = @Content(schema = @Schema(implementation = ApiErrorResponse.class)))
  })
  public ApiResponse<UnitTypeResponse> create(
      @PathVariable UUID workTypeId, @Valid @RequestBody UnitTypeRequest request) {
    return ApiResponse.of(unitTypeService.create(workTypeId, request));
  }

  @GetMapping
  @Operation(
      summary = "List unit types",
      description = "Returns unit types under one owned UNIT_BASED work type ordered by displayOrder and name.",
      security = @SecurityRequirement(name = "bearerAuth"))
  public ApiResponse<List<UnitTypeResponse>> list(@PathVariable UUID workTypeId) {
    return ApiResponse.of(unitTypeService.list(workTypeId));
  }

  @GetMapping("/{unitTypeId}")
  @Operation(
      summary = "Get a unit type",
      description = "Returns one unit type owned through the parent work type.",
      security = @SecurityRequirement(name = "bearerAuth"))
  public ApiResponse<UnitTypeResponse> get(
      @PathVariable UUID workTypeId, @PathVariable UUID unitTypeId) {
    return ApiResponse.of(unitTypeService.get(workTypeId, unitTypeId));
  }

  @PutMapping("/{unitTypeId}")
  @Operation(
      summary = "Update a unit type",
      description = "Updates one unit type owned through the parent work type.",
      security = @SecurityRequirement(name = "bearerAuth"))
  public ApiResponse<UnitTypeResponse> update(
      @PathVariable UUID workTypeId,
      @PathVariable UUID unitTypeId,
      @Valid @RequestBody UnitTypeRequest request) {
    return ApiResponse.of(unitTypeService.update(workTypeId, unitTypeId, request));
  }

  @DeleteMapping("/{unitTypeId}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @Operation(
      summary = "Delete a unit type",
      description = "Soft-deletes a unit type by deactivating it to preserve historical unit entry snapshots.",
      security = @SecurityRequirement(name = "bearerAuth"))
  public void delete(@PathVariable UUID workTypeId, @PathVariable UUID unitTypeId) {
    unitTypeService.delete(workTypeId, unitTypeId);
  }

  @Schema(name = "UnitTypeApiResponse", description = "Wrapped unit type response")
  public record UnitTypeApiResponse(UnitTypeResponse data) {}

  @Schema(name = "UnitTypeListApiResponse", description = "Wrapped unit type list response")
  public record UnitTypeListApiResponse(List<UnitTypeResponse> data) {}
}

package com.roomly.api.worktype.controller;

import com.roomly.api.common.response.ApiErrorResponse;
import com.roomly.api.common.response.ApiResponse;
import com.roomly.api.worktype.dto.CreateWorkTypeRequest;
import com.roomly.api.worktype.dto.UpdateWorkTypeRequest;
import com.roomly.api.worktype.dto.WorkTypeResponse;
import com.roomly.api.worktype.service.WorkTypeService;
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
@RequestMapping("/api/work-types")
@RequiredArgsConstructor
@Tag(name = "Work Types", description = "Authenticated work type configuration endpoints")
public class WorkTypeController {
  private final WorkTypeService workTypeService;

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  @Operation(
      summary = "Create a work type",
      description = "Creates a TIME_BASED or UNIT_BASED work type for the authenticated user with normalized name uniqueness.",
      security = @SecurityRequirement(name = "bearerAuth"))
  @ApiResponses({
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "201",
        description = "Work type created",
        content = @Content(schema = @Schema(implementation = WorkTypeApiResponse.class))),
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
        description = "Conflict with existing name or historical usage rules",
        content = @Content(schema = @Schema(implementation = ApiErrorResponse.class)))
  })
  public ApiResponse<WorkTypeResponse> create(@Valid @RequestBody CreateWorkTypeRequest request) {
    return ApiResponse.of(workTypeService.create(request));
  }

  @GetMapping
  @Operation(
      summary = "List work types",
      description = "Returns all work types owned by the authenticated user ordered by displayOrder and name.",
      security = @SecurityRequirement(name = "bearerAuth"))
  public ApiResponse<List<WorkTypeResponse>> list() {
    return ApiResponse.of(workTypeService.list());
  }

  @GetMapping("/{id}")
  @Operation(
      summary = "Get a work type",
      description = "Returns one work type owned by the authenticated user.",
      security = @SecurityRequirement(name = "bearerAuth"))
  public ApiResponse<WorkTypeResponse> get(@PathVariable UUID id) {
    return ApiResponse.of(workTypeService.get(id));
  }

  @PutMapping("/{id}")
  @Operation(
      summary = "Update a work type",
      description = "Updates one work type owned by the authenticated user and rejects unsafe calculation method changes.",
      security = @SecurityRequirement(name = "bearerAuth"))
  public ApiResponse<WorkTypeResponse> update(
      @PathVariable UUID id, @Valid @RequestBody UpdateWorkTypeRequest request) {
    return ApiResponse.of(workTypeService.update(id, request));
  }

  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @Operation(
      summary = "Delete a work type",
      description = "Soft-deletes a work type by deactivating it to preserve historical work entry snapshots.",
      security = @SecurityRequirement(name = "bearerAuth"))
  public void delete(@PathVariable UUID id) {
    workTypeService.delete(id);
  }

  @Schema(name = "WorkTypeApiResponse", description = "Wrapped work type response")
  public record WorkTypeApiResponse(WorkTypeResponse data) {}

  @Schema(name = "WorkTypeListApiResponse", description = "Wrapped work type list response")
  public record WorkTypeListApiResponse(List<WorkTypeResponse> data) {}
}

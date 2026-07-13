package com.roomly.api.imports.controller;

import com.roomly.api.common.response.ApiErrorResponse;
import com.roomly.api.common.response.ApiResponse;
import com.roomly.api.imports.dto.ExcelImportBatchDetailResponse;
import com.roomly.api.imports.dto.ExcelImportBatchSummaryResponse;
import com.roomly.api.imports.dto.ExcelImportConfirmRequest;
import com.roomly.api.imports.dto.ExcelImportConfirmResponse;
import com.roomly.api.imports.dto.ExcelImportPreviewResponse;
import com.roomly.api.imports.service.ExcelImportExecutionService;
import com.roomly.api.imports.service.ExcelImportHistoryService;
import com.roomly.api.imports.service.ExcelImportPreviewService;
import com.roomly.api.imports.service.ExcelImportUndoService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@Validated
@RestController
@RequestMapping("/api/imports/excel/schedule")
@RequiredArgsConstructor
@Tag(name = "Excel Imports", description = "Authenticated Excel schedule preview, import, history, and undo endpoints")
public class ExcelImportController {
  private final ExcelImportPreviewService previewService;
  private final ExcelImportExecutionService executionService;
  private final ExcelImportHistoryService historyService;
  private final ExcelImportUndoService undoService;

  @PostMapping("/preview")
  @ResponseStatus(HttpStatus.CREATED)
  @Operation(
      summary = "Preview an Excel schedule import",
      description = "Validates and parses the workbook without persisting work entries, absences or work types, then returns a structured preview and short-lived preview token.",
      security = @SecurityRequirement(name = "bearerAuth"))
  @ApiResponses({
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "201",
        description = "Preview created",
        content = @Content(schema = @Schema(implementation = ExcelImportPreviewApiResponse.class))),
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "400",
        description = "Workbook validation failed",
        content = @Content(schema = @Schema(implementation = ApiErrorResponse.class))),
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "401",
        description = "Authentication required",
        content = @Content(schema = @Schema(implementation = ApiErrorResponse.class))),
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "409",
        description = "Import preview could not be created safely",
        content = @Content(schema = @Schema(implementation = ApiErrorResponse.class)))
  })
  public ApiResponse<ExcelImportPreviewResponse> preview(
      @RequestPart("file") MultipartFile file,
      @RequestParam(required = false) @Min(1900) @Max(3000) Integer fallbackYear) {
    return ApiResponse.of(previewService.preview(file, fallbackYear));
  }

  @PostMapping("/confirm")
  @ResponseStatus(HttpStatus.CREATED)
  @Operation(
      summary = "Confirm an Excel schedule import",
      description = "Consumes a short-lived preview token and persists exactly the previewed import plan when it is still conflict-free.",
      security = @SecurityRequirement(name = "bearerAuth"))
  public ApiResponse<ExcelImportConfirmResponse> confirm(
      @Valid @RequestBody ExcelImportConfirmRequest request) {
    return ApiResponse.of(executionService.confirm(request.previewToken()));
  }

  @GetMapping
  @Operation(
      summary = "List Excel import history",
      description = "Returns the authenticated user's Excel import batches ordered by newest first.",
      security = @SecurityRequirement(name = "bearerAuth"))
  public ApiResponse<List<ExcelImportBatchSummaryResponse>> list() {
    return ApiResponse.of(historyService.list());
  }

  @GetMapping("/{batchId}")
  @Operation(
      summary = "Get Excel import batch details",
      description = "Returns one Excel import batch owned by the authenticated user.",
      security = @SecurityRequirement(name = "bearerAuth"))
  public ApiResponse<ExcelImportBatchDetailResponse> get(@PathVariable UUID batchId) {
    return ApiResponse.of(historyService.get(batchId));
  }

  @PostMapping("/{batchId}/undo")
  @Operation(
      summary = "Undo an Excel import batch",
      description = "Safely removes only the work entries and absences created by the selected import batch and marks the batch as undone.",
      security = @SecurityRequirement(name = "bearerAuth"))
  public ApiResponse<ExcelImportBatchDetailResponse> undo(@PathVariable UUID batchId) {
    return ApiResponse.of(undoService.undo(batchId));
  }

  @Schema(name = "ExcelImportPreviewApiResponse", description = "Wrapped Excel import preview response")
  public record ExcelImportPreviewApiResponse(ExcelImportPreviewResponse data) {}

  @Schema(name = "ExcelImportConfirmApiResponse", description = "Wrapped confirmed Excel import response")
  public record ExcelImportConfirmApiResponse(ExcelImportConfirmResponse data) {}

  @Schema(name = "ExcelImportBatchListApiResponse", description = "Wrapped Excel import history response")
  public record ExcelImportBatchListApiResponse(List<ExcelImportBatchSummaryResponse> data) {}

  @Schema(name = "ExcelImportBatchDetailApiResponse", description = "Wrapped Excel import batch detail response")
  public record ExcelImportBatchDetailApiResponse(ExcelImportBatchDetailResponse data) {}
}

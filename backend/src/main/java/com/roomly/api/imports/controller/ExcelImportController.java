package com.roomly.api.imports.controller;

import com.roomly.api.common.response.ApiErrorResponse;
import com.roomly.api.common.response.ApiResponse;
import com.roomly.api.imports.dto.ExcelImportResponse;
import com.roomly.api.imports.service.ExcelImportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.bind.annotation.RequestPart;

@RestController
@RequestMapping("/api/imports/excel")
@RequiredArgsConstructor
@Tag(name = "Excel Imports", description = "Authenticated Excel schedule import endpoints")
public class ExcelImportController {
  private final ExcelImportService excelImportService;

  @PostMapping(value = "/schedule", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  @ResponseStatus(HttpStatus.CREATED)
  @Operation(
      summary = "Import one Excel schedule workbook",
      description =
          "Parses a monthly Excel workbook for the authenticated user, imports daily work entries and absences, creates the fallback imported work type when required, and rejects re-importing the same file hash.",
      security = @SecurityRequirement(name = "bearerAuth"))
  @io.swagger.v3.oas.annotations.responses.ApiResponses({
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "201",
        description = "Workbook imported successfully",
        content = @Content(schema = @Schema(implementation = ExcelImportApiResponse.class))),
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "400",
        description = "Invalid workbook or validation failed",
        content = @Content(schema = @Schema(implementation = ApiErrorResponse.class))),
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "401",
        description = "Authentication required",
        content = @Content(schema = @Schema(implementation = ApiErrorResponse.class))),
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "409",
        description = "This workbook was already imported",
        content = @Content(schema = @Schema(implementation = ApiErrorResponse.class)))
  })
  public ApiResponse<ExcelImportResponse> importSchedule(@RequestPart("file") MultipartFile file) {
    return ApiResponse.of(excelImportService.importSchedule(file));
  }

  @Schema(name = "ExcelImportApiResponse", description = "Wrapped Excel import response")
  public record ExcelImportApiResponse(ExcelImportResponse data) {}
}

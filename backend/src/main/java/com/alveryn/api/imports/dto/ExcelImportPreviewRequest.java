package com.alveryn.api.imports.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

public record ExcelImportPreviewRequest(
    @Schema(description = "Optional fallback year used only when no safe year can be detected", example = "2025")
    @Min(1900) @Max(3000) Integer fallbackYear) {}

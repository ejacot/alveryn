package com.roomly.api.imports.dto;

import jakarta.validation.constraints.NotBlank;

public record ExcelImportConfirmRequest(@NotBlank String previewToken) {}

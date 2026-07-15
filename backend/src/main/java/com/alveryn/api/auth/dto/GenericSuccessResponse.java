package com.alveryn.api.auth.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Generic success response")
public record GenericSuccessResponse(String message) {}

package com.alveryn.api.common.response;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Standard success response wrapper")
public record ApiResponse<T>(@Schema(description = "Successful response payload") T data) {
  public static <T> ApiResponse<T> of(T data) {
    return new ApiResponse<>(data);
  }
}

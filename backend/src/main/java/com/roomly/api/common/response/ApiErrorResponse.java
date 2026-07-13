package com.roomly.api.common.response;

import java.time.OffsetDateTime;
import java.util.List;

public record ApiErrorResponse(
    OffsetDateTime timestamp,
    int status,
    String message,
    String code,
    String path,
    List<String> errors) {}

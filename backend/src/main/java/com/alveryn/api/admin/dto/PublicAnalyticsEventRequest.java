package com.alveryn.api.admin.dto;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record PublicAnalyticsEventRequest(
    @NotNull PublicAnalyticsEventType eventType,
    @NotNull UUID anonymousId) {}

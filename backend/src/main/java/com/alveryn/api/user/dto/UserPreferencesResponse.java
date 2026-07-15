package com.alveryn.api.user.dto;

import com.alveryn.api.user.entity.ThemePreference;
import com.alveryn.api.user.entity.TimeFormat;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.UUID;

@Schema(description = "User preference settings")
public record UserPreferencesResponse(
    UUID id,
    String language,
    String timezone,
    String currency,
    String dateFormat,
    TimeFormat timeFormat,
    ThemePreference theme,
    int defaultBreakMinutes,
    Integer preferredDailyMinutes,
    boolean onboardingCompleted) {}

package com.roomly.api.user.dto;

import com.roomly.api.user.entity.FirstDayOfWeek;
import com.roomly.api.user.entity.ThemePreference;
import com.roomly.api.user.entity.TimeFormat;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

@Schema(description = "User preferences update payload")
public record UserPreferencesRequest(
    @NotBlank @Size(max = 10) String language,
    @NotBlank @Size(max = 60) String timezone,
    @NotBlank @Size(min = 3, max = 3) String currency,
    @NotNull FirstDayOfWeek firstDayOfWeek,
    @NotBlank @Size(max = 30) String dateFormat,
    @NotNull TimeFormat timeFormat,
    @NotNull ThemePreference theme,
    @PositiveOrZero int defaultBreakMinutes,
    @Positive Integer preferredDailyMinutes) {}

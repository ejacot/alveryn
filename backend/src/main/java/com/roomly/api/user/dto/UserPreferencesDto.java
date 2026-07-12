package com.roomly.api.user.dto;

import com.roomly.api.user.entity.*;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.*;
import java.util.UUID;

@Schema(description = "User preference settings")
public record UserPreferencesDto(
    UUID id,
    UUID userId,
    @NotBlank @Size(max = 10) String language,
    @NotBlank @Size(max = 60) String timezone,
    @NotBlank @Size(min = 3, max = 3) String currency,
    @NotNull FirstDayOfWeek firstDayOfWeek,
    @NotBlank @Size(max = 30) String dateFormat,
    @NotNull TimeFormat timeFormat,
    @NotNull ThemePreference theme,
    @PositiveOrZero int defaultBreakMinutes,
    @Positive Integer preferredDailyMinutes,
    boolean onboardingCompleted) {}

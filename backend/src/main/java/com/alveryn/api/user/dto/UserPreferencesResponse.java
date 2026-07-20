package com.alveryn.api.user.dto;

import com.alveryn.api.user.entity.ThemePreference;
import com.alveryn.api.user.entity.TimeFormat;
import com.alveryn.api.user.entity.FirstDayOfWeek;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.UUID;

@Schema(description = "User preference settings")
public record UserPreferencesResponse(
    UUID id,
    String language,
	    String timezone,
	    String currency,
	    FirstDayOfWeek firstDayOfWeek,
	    String dateFormat,
    TimeFormat timeFormat,
    ThemePreference theme,
    int defaultBreakMinutes,
    Integer preferredDailyMinutes,
    boolean paidSickLeave,
    boolean paidVacation,
    boolean onboardingCompleted,
    int guideVersionCompleted,
    int trackingSetupVersionCompleted) {}

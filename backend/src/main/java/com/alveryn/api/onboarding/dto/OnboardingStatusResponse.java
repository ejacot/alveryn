package com.alveryn.api.onboarding.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

@Schema(description = "Onboarding status response")
public record OnboardingStatusResponse(
    boolean profileConfigured,
    boolean preferencesConfigured,
    boolean employmentConfigured,
    boolean hourlyRateConfigured,
    boolean workTypeConfigured,
    boolean onboardingCompleted,
    List<String> missingSteps) {}

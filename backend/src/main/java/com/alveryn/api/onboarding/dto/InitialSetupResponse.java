package com.alveryn.api.onboarding.dto;

import java.util.UUID;

public record InitialSetupResponse(
    UUID employmentId,
    UUID workTypeId,
    OnboardingStatusResponse status) {}

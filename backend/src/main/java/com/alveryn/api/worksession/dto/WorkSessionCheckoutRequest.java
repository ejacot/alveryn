package com.alveryn.api.worksession.dto;

import jakarta.validation.constraints.*;
import java.time.OffsetDateTime;

public record WorkSessionCheckoutRequest(@PositiveOrZero Integer breakMinutes, @Size(max = 500) String notes,
    OffsetDateTime correctedCheckInAt, OffsetDateTime correctedCheckOutAt) {}

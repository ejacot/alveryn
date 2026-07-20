package com.alveryn.api.workproject.dto;

import com.alveryn.api.workproject.entity.WorkProjectStatus;
import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.util.UUID;

public record WorkProjectRequest(@NotNull UUID employmentId, @NotBlank @Size(max=160) String title,
    @Size(max=1000) String description, @Size(max=160) String clientName, @Size(max=100) String reference,
    @NotNull LocalDate startDate, LocalDate endDate, WorkProjectStatus status, @Size(max=500) String notes, UUID addressId) {}

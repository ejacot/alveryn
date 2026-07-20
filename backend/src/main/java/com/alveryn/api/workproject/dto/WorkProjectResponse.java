package com.alveryn.api.workproject.dto;

import com.alveryn.api.workproject.entity.WorkProjectStatus;
import java.time.LocalDate;
import java.util.UUID;

public record WorkProjectResponse(UUID id, UUID employmentId, String employmentName, String title, String description,
    String clientName, String reference, LocalDate startDate, LocalDate endDate, WorkProjectStatus status,
    String notes, UUID addressId, long sessionCount) {}

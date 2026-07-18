package com.alveryn.api.workrecord.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record WorkRecordRequest(
    @NotNull LocalDate workDate,
    LocalDate workEndDate,
    UUID addressId,
    @Positive Integer teamSize,
    @Size(max = 500) String notes,
    @NotEmpty List<@Valid WorkRecordLineRequest> lines) {}

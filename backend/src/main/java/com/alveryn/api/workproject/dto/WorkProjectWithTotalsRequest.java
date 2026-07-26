package com.alveryn.api.workproject.dto;

import com.alveryn.api.workrecord.dto.WorkRecordRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

public record WorkProjectWithTotalsRequest(
    @NotNull @Valid WorkProjectRequest project,
    @NotNull @Valid WorkRecordRequest totals) {}

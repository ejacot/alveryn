package com.alveryn.api.restday.dto;

import com.alveryn.api.restday.entity.RestDaySource;
import java.time.LocalDate;
import java.util.UUID;

public record RestDayResponse(
    UUID id,
    UUID employmentId,
    LocalDate date,
    RestDaySource source,
    String notes) {}

package com.alveryn.api.restday.dto;

import jakarta.validation.constraints.Size;

public record RestDayRequest(@Size(max = 500) String notes) {}

package com.roomly.api.user.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.UUID;

@Schema(description = "User profile details")
public record UserProfileDto(
    UUID id,
    UUID userId,
    @Size(max = 80) String firstName,
    @Size(max = 80) String lastName,
    @Size(max = 100) String displayName,
    LocalDate dateOfBirth,
    @Size(max = 30) String phone,
    @Size(min = 2, max = 2) String countryCode,
    @Size(max = 100) String city,
    @Size(max = 20) String postalCode,
    @Size(max = 150) String street,
    @Size(max = 30) String houseNumber,
    @Size(max = 30) String apartment,
    @Size(max = 500) String avatarUrl,
    LocalDate employmentStartDate,
    LocalDate employmentEndDate) {}

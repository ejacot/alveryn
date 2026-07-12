package com.roomly.api.user.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;
import java.util.UUID;

@Schema(description = "User profile details")
public record UserProfileResponse(
    UUID id,
    String firstName,
    String lastName,
    String displayName,
    LocalDate dateOfBirth,
    String phone,
    String countryCode,
    String city,
    String postalCode,
    String street,
    String houseNumber,
    String apartment,
    String avatarUrl,
    LocalDate employmentStartDate,
    LocalDate employmentEndDate) {}

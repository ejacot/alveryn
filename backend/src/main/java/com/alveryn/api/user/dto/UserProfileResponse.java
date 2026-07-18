package com.alveryn.api.user.dto;

import com.alveryn.api.address.dto.AddressResponse;
import com.alveryn.api.user.entity.EmploymentType;
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
    UUID addressId,
    AddressResponse address,
    String avatarUrl,
    LocalDate employmentStartDate,
    LocalDate employmentEndDate,
    EmploymentType employmentType) {}

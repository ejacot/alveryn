package com.alveryn.api.address.dto;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record AddressRequest(
    @Size(max = 150) String street,
    @Size(max = 150) String street2,
    @Size(max = 30) String postalCode,
    @Size(max = 100) String city,
    @Size(max = 100) String region,
    @Pattern(regexp = "^[A-Za-z]{2}$", message = "must be a two-letter code") String country) {}

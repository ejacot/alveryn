package com.alveryn.api.address.dto;

import java.util.UUID;

public record AddressResponse(
    UUID id,
    String street,
    String street2,
    String postalCode,
    String city,
    String region,
    String country,
    String formatted) {}

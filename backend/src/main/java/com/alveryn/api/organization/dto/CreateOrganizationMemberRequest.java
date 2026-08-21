package com.alveryn.api.organization.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;

public record CreateOrganizationMemberRequest(
    @Size(max = 100) String firstName,
    @Size(max = 100) String lastName,
    @Email @Size(max = 320) String email,
    @Size(max = 5) String language) {}

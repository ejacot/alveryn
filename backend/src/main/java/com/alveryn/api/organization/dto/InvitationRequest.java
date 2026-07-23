package com.alveryn.api.organization.dto;
import com.alveryn.api.organization.entity.MembershipRole;
import jakarta.validation.constraints.*;
public record InvitationRequest(@NotBlank @Email @Size(max=255) String email,
    @NotNull MembershipRole role) {}

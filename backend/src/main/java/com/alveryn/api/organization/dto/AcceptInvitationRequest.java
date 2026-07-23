package com.alveryn.api.organization.dto;
import jakarta.validation.constraints.NotBlank;
public record AcceptInvitationRequest(@NotBlank String token) {}

package com.alveryn.api.organization.dto;
import jakarta.validation.constraints.Size;
public record ResendBusinessInvitationRequest(@Size(max=5) String language) {}

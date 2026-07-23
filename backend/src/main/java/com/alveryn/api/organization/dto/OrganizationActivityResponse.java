package com.alveryn.api.organization.dto;
import java.util.UUID;
public record OrganizationActivityResponse(UUID id, UUID organizationId, String name, String color,
    int defaultBreakMinutes, boolean active, int displayOrder) {}

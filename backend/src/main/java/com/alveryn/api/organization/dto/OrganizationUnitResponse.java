package com.alveryn.api.organization.dto;

import com.alveryn.api.organization.entity.CheckInMode;
import com.alveryn.api.organization.entity.OrganizationUnitType;
import java.util.UUID;

public record OrganizationUnitResponse(UUID id, UUID parentId, String name,
    OrganizationUnitType type, CheckInMode checkInMode, boolean active, int displayOrder) {}

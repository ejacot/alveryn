package com.alveryn.api.organization.dto;
import com.alveryn.api.organization.entity.MembershipRole;
import jakarta.validation.constraints.NotNull;
public record MemberRoleRequest(@NotNull MembershipRole role) {}

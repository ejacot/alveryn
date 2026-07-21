package com.alveryn.api.admin.dto;

import com.alveryn.api.user.entity.UserStatus;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record AdminDashboardResponse(
    Overview overview,
    ActivationFunnel activation,
    ProductUsage usage,
    List<RegistrationPoint> registrations,
    List<UserSummary> users) {

  public record Overview(
      long totalUsers,
      long verifiedUsers,
      long registrationsToday,
      long registrationsLast7Days,
      long activeToday,
      long activeLast7Days,
      long activeLast30Days) {}

  public record ActivationFunnel(
      long registered,
      long verified,
      long trackingSetupCompleted,
      long employmentCreated,
      long workTypeCreated,
      long firstWorkSessionCreated) {}

  public record ProductUsage(
      long timeTrackingUsers,
      long earningsTrackingUsers,
      long employments,
      long workTypes,
      long workSessions,
      long projects,
      long checkIns,
      long pdfExports) {}

  public record RegistrationPoint(LocalDate date, long registrations) {}

  public record UserSummary(
      UUID id,
      String email,
      boolean emailVerified,
      UserStatus status,
      OffsetDateTime registeredAt,
      OffsetDateTime lastLoginAt,
      OffsetDateTime lastActiveAt,
      boolean onboardingCompleted,
      long employmentCount,
      long workTypeCount,
      long workSessionCount) {}
}

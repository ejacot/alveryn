package com.alveryn.api.staffing.entity;

import com.alveryn.api.common.persistence.BaseEntity;
import com.alveryn.api.organization.entity.Organization;
import com.alveryn.api.organization.entity.OrganizationMembership;
import com.alveryn.api.organization.entity.OrganizationUnit;
import jakarta.persistence.*;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Objects;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "staffing_plans")
public class StaffingPlan extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "organization_id", nullable = false)
  private Organization organization;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "unit_id", nullable = false)
  private OrganizationUnit unit;

  @Column(name = "week_start", nullable = false)
  private LocalDate weekStart;

  @Column(nullable = false, length = 60)
  private String timezone;

  @Enumerated(EnumType.STRING)
  @Column(name = "plan_status", nullable = false, length = 20)
  private StaffingPlanStatus status = StaffingPlanStatus.ACTIVE;

  @Column(name = "draft_revision", nullable = false)
  private long draftRevision;

  @Version
  @Column(name = "lock_version", nullable = false)
  private long lockVersion;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "created_by_membership_id")
  private OrganizationMembership createdBy;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "updated_by_membership_id")
  private OrganizationMembership updatedBy;

  public StaffingPlan(Organization organization, OrganizationUnit unit, LocalDate weekStart,
      String timezone, OrganizationMembership creator) {
    this.organization = Objects.requireNonNull(organization, "organization is required");
    this.unit = Objects.requireNonNull(unit, "unit is required");
    this.weekStart = requireMonday(weekStart);
    this.timezone = validTimezone(timezone);
    requireSameOrganization(unit.getOrganization(), "unit");
    if (creator != null) requireSameOrganization(creator.getOrganization(), "creator");
    this.createdBy = creator;
    this.updatedBy = creator;
  }

  public void markDraftChanged(OrganizationMembership actor) {
    Objects.requireNonNull(actor, "actor is required");
    requireSameOrganization(actor.getOrganization(), "actor");
    draftRevision++;
    updatedBy = actor;
  }

  public void archive(OrganizationMembership actor) {
    markDraftChanged(actor);
    status = StaffingPlanStatus.ARCHIVED;
  }

  public boolean includes(LocalDate date) {
    return date != null && !date.isBefore(weekStart) && !date.isAfter(weekStart.plusDays(6));
  }

  private LocalDate requireMonday(LocalDate value) {
    Objects.requireNonNull(value, "week start is required");
    if (value.getDayOfWeek() != DayOfWeek.MONDAY) {
      throw new IllegalArgumentException("week start must be Monday");
    }
    return value;
  }

  private String validTimezone(String value) {
    if (value == null || value.isBlank()) throw new IllegalArgumentException("timezone is required");
    String candidate = value.trim();
    ZoneId.of(candidate);
    return candidate;
  }

  private void requireSameOrganization(Organization candidate, String field) {
    if (candidate != organization
        && (candidate == null || candidate.getId() == null || organization.getId() == null
            || !candidate.getId().equals(organization.getId()))) {
      throw new IllegalArgumentException(field + " must belong to the plan organization");
    }
  }
}

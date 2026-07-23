package com.alveryn.api.schedule.entity;

import com.alveryn.api.common.persistence.BaseEntity;
import com.alveryn.api.employment.entity.Employment;
import com.alveryn.api.organization.entity.Organization;
import com.alveryn.api.organization.entity.OrganizationMembership;
import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Objects;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "schedule_templates")
public class ScheduleTemplate extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "organization_id", nullable = false)
  private Organization organization;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "employment_id", nullable = false)
  private Employment employment;

  @Column(nullable = false, length = 120)
  private String name;

  @Column(nullable = false, length = 60)
  private String timezone;

  @Column(name = "valid_from", nullable = false)
  private LocalDate validFrom;

  @Column(name = "valid_to")
  private LocalDate validTo;

  @Column(nullable = false)
  private int version;

  @Enumerated(EnumType.STRING)
  @Column(name = "template_status", nullable = false, length = 20)
  private ScheduleTemplateStatus status;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "created_by_membership_id", nullable = false)
  private OrganizationMembership createdBy;

  public ScheduleTemplate(Organization organization, Employment employment, String name, String timezone,
      LocalDate validFrom, LocalDate validTo, int version, OrganizationMembership createdBy) {
    this.organization = Objects.requireNonNull(organization);
    this.employment = Objects.requireNonNull(employment);
    this.name = name == null || name.isBlank() ? "Usual week" : name.trim();
    this.timezone = ZoneId.of(timezone).getId();
    this.validFrom = Objects.requireNonNull(validFrom);
    if (validTo != null && validTo.isBefore(validFrom))
      throw new IllegalArgumentException("validTo cannot be before validFrom");
    this.validTo = validTo;
    if (version < 1) throw new IllegalArgumentException("version must be positive");
    this.version = version;
    this.status = ScheduleTemplateStatus.ACTIVE;
    this.createdBy = Objects.requireNonNull(createdBy);
  }

  public void endBefore(LocalDate nextStart) {
    if (!nextStart.isAfter(validFrom)) throw new IllegalArgumentException("new schedule must start after current schedule");
    validTo = nextStart.minusDays(1);
    status = ScheduleTemplateStatus.ARCHIVED;
  }
}

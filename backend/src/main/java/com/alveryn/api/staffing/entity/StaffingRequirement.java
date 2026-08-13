package com.alveryn.api.staffing.entity;

import com.alveryn.api.common.persistence.BaseEntity;
import com.alveryn.api.organization.entity.*;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.Objects;
import lombok.*;

@Getter @NoArgsConstructor(access = AccessLevel.PROTECTED) @Entity
@Table(name = "staffing_requirements")
public class StaffingRequirement extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "plan_day_id") private StaffingPlanDay planDay;
  @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "organization_id") private Organization organization;
  @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "unit_id") private OrganizationUnit unit;
  @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "work_type_id") private OrganizationWorkType workType;
  @Column(name = "work_date", nullable = false) private LocalDate date;
  @Column(name = "start_time") private LocalTime startTime;
  @Column(name = "end_time") private LocalTime endTime;
  @Column(name = "required_workers", nullable = false) private int requiredWorkers;
  @Column(name = "required_quantity") private BigDecimal requiredQuantity;
  @Column(length = 500) private String notes;
  @Column(name = "publication_status", nullable = false, length = 20) private String publicationStatus = "DRAFT";
  @Column(name = "published_at") private OffsetDateTime publishedAt;
  @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "created_by_membership_id") private OrganizationMembership createdBy;

  public StaffingRequirement(Organization organization, OrganizationUnit unit, OrganizationWorkType workType,
      LocalDate date, LocalTime start, LocalTime end, int workers, BigDecimal quantity, String notes,
      OrganizationMembership createdBy) {
    this.organization = Objects.requireNonNull(organization); this.unit = Objects.requireNonNull(unit);
    this.workType = Objects.requireNonNull(workType); this.date = Objects.requireNonNull(date);
    this.startTime = start; this.endTime = end; this.requiredWorkers = workers; this.requiredQuantity = quantity;
    this.notes = notes == null || notes.isBlank() ? null : notes.trim(); this.createdBy = Objects.requireNonNull(createdBy);
    if (workers <= 0 || (end != null && start == null)) throw new IllegalArgumentException("invalid staffing requirement");
  }
  public void update(LocalTime start, LocalTime end, int workers, BigDecimal quantity, String notes) {
    if (workers <= 0 || (end != null && start == null)) throw new IllegalArgumentException("invalid staffing requirement");
    this.startTime = start; this.endTime = end; this.requiredWorkers = workers; this.requiredQuantity = quantity;
    this.notes = notes == null || notes.isBlank() ? null : notes.trim(); this.publicationStatus = "DRAFT"; this.publishedAt = null;
  }
  public void publish() { this.publicationStatus = "PUBLISHED"; this.publishedAt = OffsetDateTime.now(); }
}

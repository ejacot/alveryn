package com.alveryn.api.schedule.entity;

import com.alveryn.api.common.persistence.BaseEntity;
import com.alveryn.api.employment.entity.Employment;
import com.alveryn.api.organization.entity.OrganizationMembership;
import jakarta.persistence.*;
import java.util.Objects;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "shift_assignments")
public class ShiftAssignment extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "shift_id", nullable = false)
  private ScheduledShift shift;
  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "employment_id", nullable = false)
  private Employment employment;
  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "worker_membership_id", nullable = false)
  private OrganizationMembership worker;
  @Enumerated(EnumType.STRING)
  @Column(name = "assignment_status", nullable = false, length = 20)
  private AssignmentStatus status = AssignmentStatus.ACCEPTED;
  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "assigned_by_membership_id", nullable = false)
  private OrganizationMembership assignedBy;

  public ShiftAssignment(ScheduledShift shift, Employment employment, OrganizationMembership worker,
      OrganizationMembership assignedBy) {
    this.shift = Objects.requireNonNull(shift);
    this.employment = Objects.requireNonNull(employment);
    this.worker = Objects.requireNonNull(worker);
    this.assignedBy = Objects.requireNonNull(assignedBy);
  }
}

package com.alveryn.api.staffing.entity;

import com.alveryn.api.common.persistence.BaseEntity;
import com.alveryn.api.organization.entity.Organization;
import jakarta.persistence.*;
import java.time.LocalDate;
import java.util.Objects;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "staffing_plan_days")
public class StaffingPlanDay extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "plan_id", nullable = false)
  private StaffingPlan plan;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "organization_id", nullable = false)
  private Organization organization;

  @Column(name = "work_date", nullable = false)
  private LocalDate date;

  @Column(name = "rooms_context")
  private Integer roomsContext;

  @Column(length = 1000)
  private String notes;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 30)
  private StaffingPlanDaySource source;

  public StaffingPlanDay(StaffingPlan plan, LocalDate date, Integer roomsContext, String notes,
      StaffingPlanDaySource source) {
    this.plan = Objects.requireNonNull(plan, "plan is required");
    this.organization = plan.getOrganization();
    this.date = requirePlanDate(plan, date);
    this.source = Objects.requireNonNull(source, "source is required");
    initializeContext(roomsContext, notes);
  }

  private void initializeContext(Integer roomsContext, String notes) {
    if (roomsContext != null && roomsContext < 0) {
      throw new IllegalArgumentException("rooms context cannot be negative");
    }
    this.roomsContext = roomsContext;
    this.notes = notes == null || notes.isBlank() ? null : notes.trim();
  }

  private LocalDate requirePlanDate(StaffingPlan plan, LocalDate value) {
    Objects.requireNonNull(value, "work date is required");
    if (!plan.includes(value)) throw new IllegalArgumentException("work date must belong to plan week");
    return value;
  }
}

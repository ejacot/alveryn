package com.alveryn.api.schedule.entity;

import com.alveryn.api.common.persistence.BaseEntity;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "shift_breaks")
public class ShiftBreak extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "shift_id", nullable = false)
  private ScheduledShift shift;
  @Column(name = "planned_minutes", nullable = false) private int plannedMinutes;
  @Column(nullable = false) private boolean paid;

  public ShiftBreak(ScheduledShift shift, int plannedMinutes, boolean paid) {
    if (plannedMinutes < 0) throw new IllegalArgumentException("plannedMinutes must be non-negative");
    this.shift = java.util.Objects.requireNonNull(shift);
    this.plannedMinutes = plannedMinutes;
    this.paid = paid;
  }
}

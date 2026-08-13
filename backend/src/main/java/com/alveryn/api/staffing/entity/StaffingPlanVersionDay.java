package com.alveryn.api.staffing.entity;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.Immutable;

@Getter
@Immutable
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "staffing_plan_version_days")
public class StaffingPlanVersionDay {
  @Id private UUID id;
  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "version_id", nullable = false)
  private StaffingPlanVersion version;
  @Column(name = "source_plan_day_id", nullable = false) private UUID sourcePlanDayId;
  @Column(name = "work_date", nullable = false) private LocalDate date;
  @Column(name = "rooms_context") private Integer roomsContext;
  @Column(length = 1000) private String notes;
  @Enumerated(EnumType.STRING) @Column(nullable = false, length = 30)
  private StaffingPlanDaySource source;
  @Column(name = "created_at", nullable = false, updatable = false) private OffsetDateTime createdAt;
}

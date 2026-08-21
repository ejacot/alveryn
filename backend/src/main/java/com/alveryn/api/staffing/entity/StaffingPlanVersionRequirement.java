package com.alveryn.api.staffing.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
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
@Table(name = "staffing_plan_version_requirements")
public class StaffingPlanVersionRequirement {
  @Id private UUID id;
  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "version_id", nullable = false)
  private StaffingPlanVersion version;
  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "version_day_id", nullable = false)
  private StaffingPlanVersionDay versionDay;
  @Column(name = "source_requirement_id", nullable = false) private UUID sourceRequirementId;
  @Column(name = "source_plan_day_id", nullable = false) private UUID sourcePlanDayId;
  @Column(name = "work_date", nullable = false) private LocalDate date;
  @Column(name = "unit_id", nullable = false) private UUID unitId;
  @Column(name = "unit_name", nullable = false, length = 160) private String unitName;
  @Column(name = "work_type_id", nullable = false) private UUID workTypeId;
  @Column(name = "work_type_code", nullable = false, length = 20) private String workTypeCode;
  @Column(name = "work_type_name", nullable = false, length = 120) private String workTypeName;
  @Column(name = "start_time") private LocalTime startTime;
  @Column(name = "end_time") private LocalTime endTime;
  @Column(name = "break_minutes", nullable = false) private int breakMinutes;
  @Column(name = "required_workers", nullable = false) private int requiredWorkers;
  @Column(name = "required_quantity", precision = 12, scale = 2) private BigDecimal requiredQuantity;
  @Column(name = "legacy_publication_status", nullable = false, length = 20)
  private String legacyPublicationStatus;
  @Column(length = 500) private String notes;
  @Column(name = "created_at", nullable = false, updatable = false) private OffsetDateTime createdAt;
}

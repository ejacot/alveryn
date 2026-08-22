package com.alveryn.api.staffing.entity;

import com.alveryn.api.organization.entity.CheckInMode;
import com.alveryn.api.organization.entity.MembershipStatus;
import jakarta.persistence.*;
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
@Table(name = "staffing_plan_version_assignments")
public class StaffingPlanVersionAssignment {
  @Id private UUID id;
  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "version_id", nullable = false)
  private StaffingPlanVersion version;
  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "version_requirement_id", nullable = false)
  private StaffingPlanVersionRequirement versionRequirement;
  @Column(name = "source_assignment_id", nullable = false) private UUID sourceAssignmentId;
  @Column(name = "source_requirement_id", nullable = false) private UUID sourceRequirementId;
  @Column(name = "organization_membership_id", nullable = false) private UUID membershipId;
  @Column(name = "member_display_name", nullable = false, length = 220) private String memberDisplayName;
  @Enumerated(EnumType.STRING)
  @Column(name = "membership_status_snapshot", nullable = false, length = 20)
  private MembershipStatus membershipStatus;
  @Column(name = "work_date", nullable = false) private LocalDate date;
  @Column(name = "unit_id", nullable = false) private UUID unitId;
  @Column(name = "unit_name", nullable = false, length = 160) private String unitName;
  @Column(name = "work_type_id", nullable = false) private UUID workTypeId;
  @Column(name = "work_type_code", nullable = false, length = 20) private String workTypeCode;
  @Column(name = "work_type_name", nullable = false, length = 120) private String workTypeName;
  @Column(name = "start_time") private LocalTime startTime;
  @Column(name = "end_time") private LocalTime endTime;
  @Column(name = "assignment_status", nullable = false, length = 20) private String status;
  @Enumerated(EnumType.STRING) @Column(name = "check_in_mode", nullable = false, length = 20)
  private CheckInMode checkInMode;
  @Column(name = "checked_in_at") private OffsetDateTime checkedInAt;
  @Column(name = "checked_out_at") private OffsetDateTime checkedOutAt;
  @Column(name = "created_at", nullable = false, updatable = false) private OffsetDateTime createdAt;
}

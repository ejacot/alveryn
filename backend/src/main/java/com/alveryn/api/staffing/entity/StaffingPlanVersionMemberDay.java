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
@Table(name = "staffing_plan_version_member_days")
public class StaffingPlanVersionMemberDay {
  @Id private UUID id;
  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "version_id", nullable = false)
  private StaffingPlanVersion version;
  @Column(name = "source_day_entry_id", nullable = false) private UUID sourceDayEntryId;
  @Column(name = "organization_membership_id", nullable = false) private UUID membershipId;
  @Column(name = "member_display_name", nullable = false, length = 220) private String memberDisplayName;
  @Column(name = "work_date", nullable = false) private LocalDate date;
  @Column(nullable = false, length = 20) private String status;
  @Column(length = 500) private String notes;
  @Column(nullable = false, length = 30) private String source;
  @Column(name = "source_request_id") private UUID sourceRequestId;
  @Column(name = "created_at", nullable = false, updatable = false) private OffsetDateTime createdAt;
}

package com.alveryn.api.staffing.entity;

import jakarta.persistence.*;
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
@Table(name = "staffing_plan_version_acknowledgements")
public class StaffingPlanVersionAcknowledgement {
  @Id private UUID id;
  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "version_id", nullable = false)
  private StaffingPlanVersion version;
  @Column(name = "issue_key", nullable = false, length = 200) private String issueKey;
  @Column(nullable = false, length = 30) private String severity;
  @Column(name = "acknowledged_by_membership_id") private UUID acknowledgedByMembershipId;
  @Column(name = "acknowledged_by_display_name", nullable = false, length = 220)
  private String acknowledgedByDisplayName;
  @Column(name = "acknowledged_at", nullable = false) private OffsetDateTime acknowledgedAt;
  @Column(length = 500) private String note;
  @Column(name = "created_at", nullable = false, updatable = false) private OffsetDateTime createdAt;
}

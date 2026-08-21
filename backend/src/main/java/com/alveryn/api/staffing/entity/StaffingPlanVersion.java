package com.alveryn.api.staffing.entity;

import com.alveryn.api.organization.entity.Organization;
import com.alveryn.api.organization.entity.OrganizationUnit;
import jakarta.persistence.*;
import java.math.BigDecimal;
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
@Table(name = "staffing_plan_versions")
public class StaffingPlanVersion {
  @Id private UUID id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "organization_id", nullable = false)
  private Organization organization;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "unit_id", nullable = false)
  private OrganizationUnit unit;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "plan_id", nullable = false)
  private StaffingPlan plan;

  @Column(name = "version_number", nullable = false) private int versionNumber;
  @Column(name = "source_draft_revision", nullable = false) private long sourceDraftRevision;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "previous_version_id")
  private StaffingPlanVersion previousVersion;

  @Column(name = "published_by_membership_id") private UUID publishedByMembershipId;
  @Column(name = "published_by_display_name", length = 220) private String publishedByDisplayName;

  @Column(name = "published_at", nullable = false) private OffsetDateTime publishedAt;
  @Column(nullable = false, length = 60) private String timezone;
  @Column(name = "week_start", nullable = false) private LocalDate weekStart;
  @Column(name = "coverage_required", nullable = false) private int coverageRequired;
  @Column(name = "coverage_assigned", nullable = false) private int coverageAssigned;
  @Column(name = "coverage_raw_assigned") private Integer coverageRawAssigned;
  @Column(name = "coverage_effective_assigned") private Integer coverageEffectiveAssigned;
  @Column(name = "coverage_covered") private Integer coverageCovered;
  @Column(name = "coverage_missing") private Integer coverageMissing;
  @Column(name = "coverage_overstaffed") private Integer coverageOverstaffed;
  @Column(name = "coverage_percentage", nullable = false, precision = 8, scale = 2)
  private BigDecimal coveragePercentage;

  @Enumerated(EnumType.STRING)
  @Column(name = "coverage_basis", nullable = false, length = 30)
  private StaffingPlanCoverageBasis coverageBasis;

  @Column(name = "warning_count", nullable = false) private int warningCount;
  @Column(nullable = false, length = 64) private String checksum;

  @Enumerated(EnumType.STRING)
  @Column(name = "publication_kind", nullable = false, length = 30)
  private StaffingPlanPublicationKind publicationKind;

  @Column(name = "source_draft_complete", nullable = false)
  private boolean sourceDraftComplete;

  @Column(name = "publication_note", length = 1000) private String publicationNote;
  @Column(name = "created_at", nullable = false, updatable = false) private OffsetDateTime createdAt;
}

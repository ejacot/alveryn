package com.alveryn.api.schedule.entity;

import com.alveryn.api.common.persistence.BaseEntity;
import com.alveryn.api.organization.entity.Organization;
import com.alveryn.api.organization.entity.OrganizationMembership;
import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.time.LocalDate;
import java.util.Objects;
import com.alveryn.api.worktype.entity.WorkType;
import com.alveryn.api.absence.entity.AbsenceTypeSetting;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "scheduled_shifts")
public class ScheduledShift extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "organization_id", nullable = false)
  private Organization organization;
  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "template_rule_id")
  private ScheduleTemplateRule templateRule;
  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "work_type_id")
  private WorkType workType;
  @Enumerated(EnumType.STRING) @Column(name = "item_type", nullable = false, length = 20)
  private ScheduleItemType itemType;
  @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "absence_type_id")
  private AbsenceTypeSetting absenceType;
  @Column(name = "absence_type_name_snapshot", length = 80) private String absenceTypeNameSnapshot;
  @Column(name = "absence_type_color_snapshot", length = 7) private String absenceTypeColorSnapshot;
  @Column(name = "work_type_name_snapshot", length = 100)
  private String workTypeNameSnapshot;
  @Column(name = "work_type_color_snapshot", length = 7)
  private String workTypeColorSnapshot;
  @Column(name = "template_occurrence_date") private LocalDate templateOccurrenceDate;
  @Column(name = "starts_at", nullable = false) private OffsetDateTime startsAt;
  @Column(name = "ends_at", nullable = false) private OffsetDateTime endsAt;
  @Column(nullable = false, length = 60) private String timezone;
  @Column(name = "required_workers", nullable = false) private int requiredWorkers = 1;
  @Enumerated(EnumType.STRING) @Column(name = "shift_status", nullable = false, length = 20)
  private ShiftStatus status = ShiftStatus.PUBLISHED;
  @Enumerated(EnumType.STRING) @Column(name = "shift_source", nullable = false, length = 30)
  private ShiftSource source = ShiftSource.RECURRING_TEMPLATE;
  @Column(name = "manually_overridden", nullable = false) private boolean manuallyOverridden;
  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "created_by_membership_id", nullable = false)
  private OrganizationMembership createdBy;
  @Column(name = "published_at") private OffsetDateTime publishedAt;
  @Column(nullable = false) private int version = 1;

  public ScheduledShift(Organization organization, ScheduleTemplateRule rule, OffsetDateTime startsAt,
      OffsetDateTime endsAt, String timezone, OrganizationMembership createdBy) {
    this.organization = Objects.requireNonNull(organization);
    this.templateRule = Objects.requireNonNull(rule);
    this.workType = rule.getWorkType();
    this.itemType = rule.getItemType();
    this.absenceType = rule.getAbsenceType();
    this.absenceTypeNameSnapshot = rule.getAbsenceTypeNameSnapshot();
    this.absenceTypeColorSnapshot = rule.getAbsenceTypeColorSnapshot();
    this.workTypeNameSnapshot = rule.getWorkTypeNameSnapshot();
    this.workTypeColorSnapshot = rule.getWorkTypeColorSnapshot();
    this.templateOccurrenceDate = startsAt.atZoneSameInstant(java.time.ZoneId.of(timezone)).toLocalDate();
    this.startsAt = Objects.requireNonNull(startsAt);
    this.endsAt = Objects.requireNonNull(endsAt);
    if (!endsAt.isAfter(startsAt)) throw new IllegalArgumentException("shift end must be after start");
    this.timezone = Objects.requireNonNull(timezone);
    this.createdBy = Objects.requireNonNull(createdBy);
    this.publishedAt = OffsetDateTime.now();
  }

  public void override(OffsetDateTime nextStart, OffsetDateTime nextEnd) {
    if (!nextEnd.isAfter(nextStart)) throw new IllegalArgumentException("shift end must be after start");
    startsAt = Objects.requireNonNull(nextStart);
    endsAt = Objects.requireNonNull(nextEnd);
    manuallyOverridden = true;
    version++;
  }
}

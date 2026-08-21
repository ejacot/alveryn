package com.alveryn.api.staffing.entity;

import com.alveryn.api.common.persistence.BaseEntity;
import com.alveryn.api.organization.entity.OrganizationMembership;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.*;
import lombok.*;

@Getter @NoArgsConstructor(access = AccessLevel.PROTECTED) @Entity
@Table(name = "staffing_assignment_results")
public class StaffingAssignmentResult extends BaseEntity {
  @OneToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "assignment_id") private StaffingAssignment assignment;
  @Column(name = "actual_start_time") private LocalTime actualStartTime;
  @Column(name = "actual_end_time") private LocalTime actualEndTime;
  @Column(name = "break_minutes", nullable = false) private int breakMinutes = 30;
  @Column(name = "completed_quantity", precision = 12, scale = 2) private BigDecimal completedQuantity;
  @Column(length = 1000) private String notes;
  @Column(name = "approval_status", nullable = false, length = 24) private String approvalStatus = "DRAFT";
  @Column(name = "submitted_at") private OffsetDateTime submittedAt;
  @Column(name = "reviewed_at") private OffsetDateTime reviewedAt;
  @Column(name = "checked_in_at") private OffsetDateTime checkedInAt;
  @Column(name = "checked_out_at") private OffsetDateTime checkedOutAt;
  @Column(name = "time_capture_source", nullable = false, length = 20) private String timeCaptureSource = "MANUAL";
  @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "reviewed_by_membership_id") private OrganizationMembership reviewedBy;

  public StaffingAssignmentResult(StaffingAssignment assignment) { this.assignment = assignment; }
  public void save(LocalTime start, LocalTime end, int breakMinutes, BigDecimal quantity, String notes, boolean submit) {
    if (end != null && start == null) throw new IllegalArgumentException("actual start time is required");
    this.actualStartTime = start; this.actualEndTime = end; this.breakMinutes = breakMinutes;
    this.completedQuantity = quantity; this.notes = notes; this.approvalStatus = submit ? "SUBMITTED" : "DRAFT";
    this.submittedAt = submit ? OffsetDateTime.now() : null; this.reviewedAt = null; this.reviewedBy = null;
  }
  public void approve(OrganizationMembership reviewer, LocalTime start, LocalTime end, int breakMinutes, BigDecimal quantity, String notes) {
    save(start, end, breakMinutes, quantity, notes, true);
    this.approvalStatus = "APPROVED"; this.reviewedBy = reviewer; this.reviewedAt = OffsetDateTime.now();
  }
  public void checkIn(OffsetDateTime instant, LocalTime localTime, int defaultBreakMinutes) {
    if (checkedInAt != null) throw new IllegalArgumentException("assignment is already checked in");
    this.checkedInAt = instant; this.actualStartTime = localTime; this.breakMinutes = defaultBreakMinutes;
    this.timeCaptureSource = "CHECK_IN"; this.approvalStatus = "DRAFT";
  }
  public void checkOut(OffsetDateTime instant, LocalTime localTime) {
    if (checkedInAt == null) throw new IllegalArgumentException("check-in is required before check-out");
    if (checkedOutAt != null) throw new IllegalArgumentException("assignment is already checked out");
    this.checkedOutAt = instant; this.actualEndTime = localTime; this.approvalStatus = "SUBMITTED";
    this.submittedAt = instant;
  }
}

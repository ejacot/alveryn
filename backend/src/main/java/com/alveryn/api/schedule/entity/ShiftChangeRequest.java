package com.alveryn.api.schedule.entity;
import com.alveryn.api.common.persistence.BaseEntity;
import com.alveryn.api.organization.entity.OrganizationMembership;
import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.Objects;
import lombok.*;

@Getter @NoArgsConstructor(access=AccessLevel.PROTECTED) @Entity
@Table(name="shift_change_requests")
public class ShiftChangeRequest extends BaseEntity {
  @ManyToOne(fetch=FetchType.LAZY, optional=false) @JoinColumn(name="shift_assignment_id",nullable=false)
  private ShiftAssignment assignment;
  @ManyToOne(fetch=FetchType.LAZY, optional=false) @JoinColumn(name="requested_by_membership_id",nullable=false)
  private OrganizationMembership requestedBy;
  @Enumerated(EnumType.STRING) @Column(name="request_type",nullable=false,length=20)
  private ShiftChangeRequestType type;
  @Column(name="proposed_start") private OffsetDateTime proposedStart;
  @Column(name="proposed_end") private OffsetDateTime proposedEnd;
  @Column(length=500) private String reason;
  @Enumerated(EnumType.STRING) @Column(name="request_status",nullable=false,length=20)
  private ShiftChangeRequestStatus status=ShiftChangeRequestStatus.PENDING;
  @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="decided_by_membership_id")
  private OrganizationMembership decidedBy;
  @Column(name="decided_at") private OffsetDateTime decidedAt;

  public ShiftChangeRequest(ShiftAssignment assignment, OrganizationMembership requester,
      ShiftChangeRequestType type, OffsetDateTime start, OffsetDateTime end, String reason) {
    this.assignment=Objects.requireNonNull(assignment); this.requestedBy=Objects.requireNonNull(requester);
    if (!assignment.getWorker().getId().equals(requester.getId()))
      throw new IllegalArgumentException("requester is not assigned to this shift");
    this.type=Objects.requireNonNull(type);
    if (type == ShiftChangeRequestType.SWAP) throw new IllegalArgumentException("swap requires a target employee");
    if (type == ShiftChangeRequestType.TIME_CHANGE && (start == null || end == null || !end.isAfter(start)))
      throw new IllegalArgumentException("time change requires a valid proposed interval");
    this.proposedStart=start; this.proposedEnd=end;
    this.reason=reason == null || reason.isBlank() ? null : reason.trim();
    if (this.reason != null && this.reason.length()>500) throw new IllegalArgumentException("reason exceeds 500 characters");
  }
  public void decide(boolean approve, OrganizationMembership manager, OffsetDateTime at) {
    if (status != ShiftChangeRequestStatus.PENDING) throw new IllegalStateException("request is already decided");
    status=approve?ShiftChangeRequestStatus.APPROVED:ShiftChangeRequestStatus.REJECTED;
    decidedBy=Objects.requireNonNull(manager); decidedAt=Objects.requireNonNull(at);
  }
  public void cancel() {
    if(status!=ShiftChangeRequestStatus.PENDING) throw new IllegalStateException("only pending requests can be cancelled");
    status=ShiftChangeRequestStatus.CANCELLED;
  }
}

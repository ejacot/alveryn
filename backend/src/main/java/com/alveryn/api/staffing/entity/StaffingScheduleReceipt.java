package com.alveryn.api.staffing.entity;
import com.alveryn.api.common.persistence.BaseEntity;
import com.alveryn.api.organization.entity.*;
import jakarta.persistence.*;
import java.time.*;
import java.util.Objects;
import lombok.*;
@Getter @NoArgsConstructor(access=AccessLevel.PROTECTED) @Entity @Table(name="staffing_schedule_receipts")
public class StaffingScheduleReceipt extends BaseEntity {
 @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="organization_id") private Organization organization;
 @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="membership_id") private OrganizationMembership membership;
 @Column(name="week_start",nullable=false) private LocalDate weekStart;
 @Column(name="viewed_at",nullable=false) private OffsetDateTime viewedAt;
 public StaffingScheduleReceipt(Organization organization, OrganizationMembership membership, LocalDate weekStart) { this.organization=Objects.requireNonNull(organization); this.membership=Objects.requireNonNull(membership); this.weekStart=Objects.requireNonNull(weekStart); markViewed(); }
 public void markViewed(){viewedAt=OffsetDateTime.now();}
}

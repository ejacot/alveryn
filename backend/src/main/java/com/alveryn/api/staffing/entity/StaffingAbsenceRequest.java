package com.alveryn.api.staffing.entity;
import com.alveryn.api.common.persistence.BaseEntity;
import com.alveryn.api.organization.entity.*;
import jakarta.persistence.*;
import java.time.*;
import lombok.*;
@Getter @NoArgsConstructor(access=AccessLevel.PROTECTED) @Entity @Table(name="staffing_absence_requests")
public class StaffingAbsenceRequest extends BaseEntity {
 @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="organization_id") private Organization organization;
 @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="membership_id") private OrganizationMembership membership;
 @Column(name="absence_type",nullable=false,length=20) private String type;
 @Column(name="start_date",nullable=false) private LocalDate startDate;
 @Column(name="end_date",nullable=false) private LocalDate endDate;
 @Column(length=1000) private String notes;
 @Column(name="request_status",nullable=false,length=20) private String status="PENDING";
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="reviewed_by_membership_id") private OrganizationMembership reviewedBy;
 @Column(name="reviewed_at") private OffsetDateTime reviewedAt;
 public StaffingAbsenceRequest(OrganizationMembership member,String type,LocalDate start,LocalDate end,String notes){this.organization=member.getOrganization();this.membership=member;this.type=type;this.startDate=start;this.endDate=end;this.notes=notes;}
 public void decide(boolean approve,OrganizationMembership reviewer){if(!"PENDING".equals(status))throw new IllegalArgumentException("request already decided");status=approve?"APPROVED":"REJECTED";reviewedBy=reviewer;reviewedAt=OffsetDateTime.now();}
}

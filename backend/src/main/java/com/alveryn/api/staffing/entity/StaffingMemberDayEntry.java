package com.alveryn.api.staffing.entity;

import com.alveryn.api.common.persistence.BaseEntity;
import com.alveryn.api.organization.entity.*;
import jakarta.persistence.*;
import java.time.LocalDate;
import java.util.Objects;
import lombok.*;

@Getter @NoArgsConstructor(access = AccessLevel.PROTECTED) @Entity
@Table(name = "staffing_member_day_entries")
public class StaffingMemberDayEntry extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "organization_id") private Organization organization;
  @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "membership_id") private OrganizationMembership membership;
  @Column(name = "work_date", nullable = false) private LocalDate date;
  @Column(name = "entry_type", nullable = false, length = 20) private String type;
  @Column(length = 500) private String notes;
  @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "created_by_membership_id") private OrganizationMembership createdBy;

  public StaffingMemberDayEntry(Organization organization, OrganizationMembership membership, LocalDate date,
      String type, String notes, OrganizationMembership createdBy) {
    this.organization = Objects.requireNonNull(organization); this.membership = Objects.requireNonNull(membership);
    this.date = Objects.requireNonNull(date); this.createdBy = Objects.requireNonNull(createdBy); update(type, notes);
  }
  public void update(String type, String notes) {
    if (!java.util.Set.of("REST_DAY", "VACATION", "SICK").contains(type)) throw new IllegalArgumentException("invalid day entry type");
    this.type = type; this.notes = notes == null || notes.isBlank() ? null : notes.trim();
  }
}

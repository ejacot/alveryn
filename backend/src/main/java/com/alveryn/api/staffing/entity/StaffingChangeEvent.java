package com.alveryn.api.staffing.entity;
import com.alveryn.api.common.persistence.BaseEntity;
import com.alveryn.api.organization.entity.*;
import jakarta.persistence.*;
import java.time.LocalDate;
import java.util.*;
import lombok.*;
@Getter @NoArgsConstructor(access=AccessLevel.PROTECTED) @Entity @Table(name="staffing_change_events")
public class StaffingChangeEvent extends BaseEntity {
 @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="organization_id") private Organization organization;
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="actor_membership_id") private OrganizationMembership actor;
 @Column(name="event_type",nullable=false,length=40) private String eventType;
 @Column(name="entity_type",nullable=false,length=30) private String entityType;
 @Column(name="entity_id") private UUID entityId;
 @Column(name="work_date") private LocalDate workDate;
 @Column(nullable=false,length=500) private String summary;
 public StaffingChangeEvent(Organization organization,OrganizationMembership actor,String eventType,String entityType,UUID entityId,LocalDate workDate,String summary){this.organization=Objects.requireNonNull(organization);this.actor=actor;this.eventType=Objects.requireNonNull(eventType);this.entityType=Objects.requireNonNull(entityType);this.entityId=entityId;this.workDate=workDate;this.summary=Objects.requireNonNull(summary);}
}

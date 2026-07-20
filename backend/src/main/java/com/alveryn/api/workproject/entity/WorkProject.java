package com.alveryn.api.workproject.entity;

import com.alveryn.api.address.entity.Address;
import com.alveryn.api.common.persistence.BaseEntity;
import com.alveryn.api.employment.entity.Employment;
import com.alveryn.api.user.entity.UserAccount;
import jakarta.persistence.*;
import java.time.LocalDate;
import java.util.Objects;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter @Entity @Table(name = "work_projects") @NoArgsConstructor(access = AccessLevel.PROTECTED)
public class WorkProject extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "user_id", nullable = false) private UserAccount user;
  @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "employment_id", nullable = false) private Employment employment;
  @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "address_id") private Address address;
  @Column(nullable = false, length = 160) private String title;
  @Column(length = 1000) private String description;
  @Column(name = "client_name", length = 160) private String clientName;
  @Column(length = 100) private String reference;
  @Column(name = "start_date", nullable = false) private LocalDate startDate;
  @Column(name = "end_date") private LocalDate endDate;
  @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private WorkProjectStatus status = WorkProjectStatus.ACTIVE;
  @Column(length = 500) private String notes;

  public WorkProject(UserAccount user, Employment employment, String title, LocalDate startDate) {
    this.user = Objects.requireNonNull(user); this.employment = Objects.requireNonNull(employment); update(title, null, null, null, startDate, null, WorkProjectStatus.ACTIVE, null, null);
  }
  public void update(String title, String description, String clientName, String reference, LocalDate startDate,
      LocalDate endDate, WorkProjectStatus status, String notes, Address address) {
    if (title == null || title.isBlank()) throw new IllegalArgumentException("project title is required");
    if (endDate != null && endDate.isBefore(startDate)) throw new IllegalArgumentException("project end date must not precede start date");
    if (address != null && !address.getUser().getId().equals(user.getId())) throw new IllegalArgumentException("address must belong to project user");
    this.title=title.trim(); this.description=clean(description); this.clientName=clean(clientName); this.reference=clean(reference);
    this.startDate=Objects.requireNonNull(startDate); this.endDate=endDate; this.status=Objects.requireNonNull(status); this.notes=clean(notes); this.address=address;
  }
  public boolean contains(LocalDate date) { return !date.isBefore(startDate) && (endDate == null || !date.isAfter(endDate)); }
  private String clean(String value) { return value == null || value.isBlank() ? null : value.trim(); }
}

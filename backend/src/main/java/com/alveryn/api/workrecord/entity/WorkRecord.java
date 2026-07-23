package com.alveryn.api.workrecord.entity;

import com.alveryn.api.address.entity.Address;
import com.alveryn.api.common.persistence.BaseEntity;
import com.alveryn.api.employment.entity.Employment;
import com.alveryn.api.user.entity.UserAccount;
import com.alveryn.api.workproject.entity.WorkProject;
import com.alveryn.api.schedule.entity.ShiftAssignment;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.util.Objects;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "work_records")
public class WorkRecord extends BaseEntity {
  @Enumerated(EnumType.STRING)
  @Column(name = "entry_kind", nullable = false, length = 20)
  private WorkEntryKind entryKind = WorkEntryKind.WORK_SESSION;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "project_id")
  private WorkProject project;
  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "employment_id")
  private Employment employment;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "shift_assignment_id")
  private ShiftAssignment shiftAssignment;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "user_id", nullable = false)
  private UserAccount user;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "address_id")
  private Address address;

  @Column(name = "work_date", nullable = false)
  private LocalDate workDate;

  @Column(name = "work_end_date")
  private LocalDate workEndDate;

  @Column(name = "team_size")
  private Integer teamSize;

  @Column(length = 500)
  private String notes;

  public WorkRecord(UserAccount user, Address address, LocalDate workDate, LocalDate workEndDate, Integer teamSize, String notes) {
    this.user = Objects.requireNonNull(user, "user is required");
    changeAddress(address);
    updateDateRange(workDate, workEndDate);
    updateTeamSize(teamSize);
    updateNotes(notes);
  }

  public void assignEmployment(Employment value) {
    if (value != null && !value.getUser().getId().equals(user.getId())) throw new IllegalArgumentException("employment must belong to record user");
    employment = value;
  }

  public void linkPlannedShift(ShiftAssignment value) {
    if (value != null && employment != null
        && !value.getEmployment().getId().equals(employment.getId())) {
      throw new IllegalArgumentException("planned shift and work record must use the same employment");
    }
    shiftAssignment = value;
  }

  public void classifyAs(WorkEntryKind value) {
    entryKind = Objects.requireNonNull(value, "entryKind is required");
  }

  public void assignProject(WorkProject value) {
    if (value != null && !value.getUser().getId().equals(user.getId())) throw new IllegalArgumentException("project must belong to session user");
    if (value != null && employment != null && !value.getEmployment().getId().equals(employment.getId())) throw new IllegalArgumentException("project and session must use the same employment");
    if (value != null && !value.contains(workDate)) throw new IllegalArgumentException("session date must be inside project period");
    project = value;
  }

  public WorkRecord(UserAccount user, Address address, LocalDate workDate, Integer teamSize, String notes) {
    this(user, address, workDate, null, teamSize, notes);
  }

  public void update(Address nextAddress, LocalDate nextWorkDate, LocalDate nextWorkEndDate, Integer nextTeamSize, String nextNotes) {
    changeAddress(nextAddress);
    updateDateRange(nextWorkDate, nextWorkEndDate);
    updateTeamSize(nextTeamSize);
    updateNotes(nextNotes);
  }

  private void updateDateRange(LocalDate startDate, LocalDate endDate) {
    LocalDate requiredStart = Objects.requireNonNull(startDate, "workDate is required");
    if (endDate != null && endDate.isBefore(requiredStart)) {
      throw new IllegalArgumentException("workEndDate must be on or after workDate");
    }
    workDate = requiredStart;
    workEndDate = endDate;
  }

  public void updateTeamSize(Integer value) {
    if (value != null && value < 1) {
      throw new IllegalArgumentException("teamSize must be positive");
    }
    teamSize = value;
  }

  public void updateNotes(String value) {
    if (value != null && value.length() > 500) {
      throw new IllegalArgumentException("notes exceeds 500 characters");
    }
    notes = value;
  }

  public void changeAddress(Address value) {
    if (value != null && !value.getUser().getId().equals(user.getId())) {
      throw new IllegalArgumentException("address must belong to record user");
    }
    address = value;
  }
}

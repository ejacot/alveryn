package com.alveryn.api.absence.entity;

import com.alveryn.api.common.persistence.BaseEntity;
import com.alveryn.api.user.entity.UserAccount;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
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
@Table(name = "absences")
public class Absence extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "user_id", nullable = false)
  private UserAccount user;

  @Enumerated(EnumType.STRING)
  @Column(name = "absence_type", nullable = false, length = 30)
  private AbsenceType absenceType;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "absence_type_id")
  private AbsenceTypeSetting absenceTypeSetting;

  @Column(name = "absence_type_name_snapshot", nullable = false, length = 80)
  private String absenceTypeNameSnapshot;

  @Column(name = "paid_snapshot", nullable = false)
  private boolean paidSnapshot;

  @Column(name = "paid_minutes_per_day_snapshot", nullable = false)
  private int paidMinutesPerDaySnapshot;

  @Column(name = "start_date", nullable = false)
  private LocalDate startDate;

  @Column(name = "end_date", nullable = false)
  private LocalDate endDate;

  @Column(length = 500)
  private String notes;

  public Absence(
      UserAccount user, AbsenceType absenceType, LocalDate startDate, LocalDate endDate) {
    this.user = Objects.requireNonNull(user, "user is required");
    this.absenceType = Objects.requireNonNull(absenceType, "absenceType is required");
    this.absenceTypeNameSnapshot = defaultName(absenceType);
    this.paidSnapshot = false;
    this.paidMinutesPerDaySnapshot = 0;
    if (startDate == null || endDate == null || endDate.isBefore(startDate))
      throw new IllegalArgumentException("invalid absence range");
    this.startDate = startDate;
    this.endDate = endDate;
  }

  public Absence(
      UserAccount user, AbsenceTypeSetting absenceTypeSetting, LocalDate startDate, LocalDate endDate) {
    this.user = Objects.requireNonNull(user, "user is required");
    applyAbsenceType(absenceTypeSetting);
    if (startDate == null || endDate == null || endDate.isBefore(startDate))
      throw new IllegalArgumentException("invalid absence range");
    this.startDate = startDate;
    this.endDate = endDate;
  }

  public void update(AbsenceType absenceType, LocalDate startDate, LocalDate endDate, String notes) {
    this.absenceType = Objects.requireNonNull(absenceType, "absenceType is required");
    this.absenceTypeSetting = null;
    this.absenceTypeNameSnapshot = defaultName(absenceType);
    this.paidSnapshot = false;
    this.paidMinutesPerDaySnapshot = 0;
    if (startDate == null || endDate == null || endDate.isBefore(startDate)) {
      throw new IllegalArgumentException("invalid absence range");
    }
    this.startDate = startDate;
    this.endDate = endDate;
    updateNotes(notes);
  }

  public void update(
      AbsenceTypeSetting absenceTypeSetting, LocalDate startDate, LocalDate endDate, String notes) {
    applyAbsenceType(absenceTypeSetting);
    if (startDate == null || endDate == null || endDate.isBefore(startDate)) {
      throw new IllegalArgumentException("invalid absence range");
    }
    this.startDate = startDate;
    this.endDate = endDate;
    updateNotes(notes);
  }

  private void applyAbsenceType(AbsenceTypeSetting value) {
    AbsenceTypeSetting type = Objects.requireNonNull(value, "absenceType is required");
    absenceTypeSetting = type;
    absenceType = type.getCode() == null ? AbsenceType.DAY_OFF : type.getCode();
    absenceTypeNameSnapshot = type.getName();
    paidSnapshot = type.isPaid();
    paidMinutesPerDaySnapshot = type.getPaidMinutesPerDay();
  }

  public void updateNotes(String value) {
    if (value != null && value.length() > 500)
      throw new IllegalArgumentException("notes exceeds 500 characters");
    notes = value;
  }

  private static String defaultName(AbsenceType absenceType) {
    return switch (absenceType) {
      case DAY_OFF -> "Free";
      case VACATION -> "Vacation";
      case SICK_LEAVE -> "Sick";
      case PUBLIC_HOLIDAY -> "Holiday";
    };
  }
}

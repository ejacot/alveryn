package com.roomly.api.absence.entity;

import com.roomly.api.common.persistence.BaseEntity;
import com.roomly.api.user.entity.UserAccount;
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
    if (startDate == null || endDate == null || endDate.isBefore(startDate))
      throw new IllegalArgumentException("invalid absence range");
    this.startDate = startDate;
    this.endDate = endDate;
  }

  public void updateNotes(String value) {
    if (value != null && value.length() > 500)
      throw new IllegalArgumentException("notes exceeds 500 characters");
    notes = value;
  }
}

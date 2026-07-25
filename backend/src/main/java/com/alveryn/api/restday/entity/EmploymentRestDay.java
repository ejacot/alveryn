package com.alveryn.api.restday.entity;

import com.alveryn.api.common.persistence.BaseEntity;
import com.alveryn.api.employment.entity.Employment;
import com.alveryn.api.user.entity.UserAccount;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.LocalDate;
import java.util.Objects;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Entity
@Table(
    name = "employment_rest_days",
    uniqueConstraints = @UniqueConstraint(
        name = "uq_employment_rest_days_employment_date",
        columnNames = {"employment_id", "rest_date"}))
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class EmploymentRestDay extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "user_id", nullable = false)
  private UserAccount user;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "employment_id", nullable = false)
  private Employment employment;

  @Column(name = "rest_date", nullable = false)
  private LocalDate date;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 20)
  private RestDaySource source;

  @Column(length = 500)
  private String notes;

  public EmploymentRestDay(UserAccount user, Employment employment, LocalDate date, String notes) {
    this.user = Objects.requireNonNull(user, "user is required");
    this.employment = Objects.requireNonNull(employment, "employment is required");
    if (!employment.getUser().getId().equals(user.getId())) {
      throw new IllegalArgumentException("employment must belong to rest-day user");
    }
    this.date = Objects.requireNonNull(date, "date is required");
    this.source = RestDaySource.MANUAL;
    updateNotes(notes);
  }

  public void updateNotes(String value) {
    if (value != null && value.length() > 500) {
      throw new IllegalArgumentException("notes exceeds 500 characters");
    }
    notes = value == null || value.isBlank() ? null : value.trim();
  }
}

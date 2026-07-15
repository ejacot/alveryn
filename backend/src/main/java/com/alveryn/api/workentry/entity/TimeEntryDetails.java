package com.alveryn.api.workentry.entity;

import com.alveryn.api.common.persistence.BaseEntity;
import com.alveryn.api.worktype.entity.CalculationMethod;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Objects;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "time_entry_details")
public class TimeEntryDetails extends BaseEntity {
  @OneToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "work_entry_id", nullable = false, unique = true)
  private WorkEntry workEntry;

  @Column(name = "start_time", nullable = false)
  private LocalTime startTime;

  @Column(name = "end_time", nullable = false)
  private LocalTime endTime;

  @Column(name = "break_minutes", nullable = false)
  private int breakMinutes;

  @Column(name = "total_interval_minutes", nullable = false)
  private int totalIntervalMinutes;

  public TimeEntryDetails(
      WorkEntry workEntry, LocalTime startTime, LocalTime endTime, int breakMinutes) {
    this.workEntry = Objects.requireNonNull(workEntry, "workEntry is required");
    if (workEntry.getCalculationMethodSnapshot() != CalculationMethod.TIME_BASED)
      throw new IllegalArgumentException("requires TIME_BASED entry");
    this.startTime = Objects.requireNonNull(startTime, "startTime is required");
    this.endTime = Objects.requireNonNull(endTime, "endTime is required");
    if (breakMinutes < 0) throw new IllegalArgumentException("breakMinutes must be non-negative");
    this.totalIntervalMinutes = intervalMinutes(startTime, endTime);
    if (breakMinutes >= totalIntervalMinutes)
      throw new IllegalArgumentException("break must be shorter than interval");
    this.breakMinutes = breakMinutes;
  }

  public int getWorkedMinutes() {
    return totalIntervalMinutes - breakMinutes;
  }

  public static int intervalMinutes(LocalTime start, LocalTime end) {
    LocalDate day = LocalDate.of(2000, 1, 1);
    LocalDateTime from = LocalDateTime.of(day, start);
    LocalDateTime to = LocalDateTime.of(end.isAfter(start) ? day : day.plusDays(1), end);
    return Math.toIntExact(Duration.between(from, to).toMinutes());
  }
}

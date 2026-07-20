package com.alveryn.api.worksession.entity;

import com.alveryn.api.common.persistence.BaseEntity;
import com.alveryn.api.employment.entity.Employment;
import com.alveryn.api.user.entity.UserAccount;
import com.alveryn.api.workrecord.entity.WorkRecord;
import com.alveryn.api.worktype.entity.WorkType;
import jakarta.persistence.*;
import java.time.OffsetDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "work_intervals")
public class WorkSession extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "user_id", nullable = false) private UserAccount user;
  @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "employment_id", nullable = false) private Employment employment;
  @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "work_type_id", nullable = false) private WorkType workType;
  @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "work_session_id") private WorkRecord workRecord;
  @Column(name = "checked_in_at", nullable = false) private OffsetDateTime checkedInAt;
  @Column(name = "checked_out_at") private OffsetDateTime checkedOutAt;
  @Column(nullable = false, length = 60) private String timezone;
  @Column(name = "break_minutes", nullable = false) private int breakMinutes;
  @Column(name = "pause_started_at") private OffsetDateTime pauseStartedAt;
  @Column(name = "accumulated_break_seconds", nullable = false) private long accumulatedBreakSeconds;
  @Column(length = 500) private String notes;

  public WorkSession(UserAccount user, Employment employment, WorkType workType, OffsetDateTime checkedInAt, String timezone) {
    this.user = user; this.employment = employment; this.workType = workType; this.checkedInAt = checkedInAt; this.timezone = timezone;
  }
  public void complete(OffsetDateTime at, int breaks, String value, WorkRecord record) {
    if (at.isBefore(checkedInAt)) throw new IllegalArgumentException("check-out cannot be before check-in");
    checkedOutAt = at; breakMinutes = breaks; notes = value == null || value.isBlank() ? null : value.trim(); workRecord = record;
  }
  public void startPause(OffsetDateTime at) {
    if (checkedOutAt != null || pauseStartedAt != null) throw new IllegalArgumentException("pause cannot be started");
    pauseStartedAt = at;
  }
  public void endPause(OffsetDateTime at) {
    if (pauseStartedAt == null) throw new IllegalArgumentException("no active pause");
    if (at.isBefore(pauseStartedAt)) throw new IllegalArgumentException("pause end cannot be before pause start");
    accumulatedBreakSeconds += java.time.Duration.between(pauseStartedAt, at).getSeconds();
    pauseStartedAt = null;
  }
  public void correctCheckIn(OffsetDateTime value) {
    if (checkedOutAt != null || value.isAfter(OffsetDateTime.now())) throw new IllegalArgumentException("invalid check-in time");
    checkedInAt = value;
  }
}

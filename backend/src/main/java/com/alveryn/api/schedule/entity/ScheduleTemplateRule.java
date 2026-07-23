package com.alveryn.api.schedule.entity;

import com.alveryn.api.common.persistence.BaseEntity;
import jakarta.persistence.*;
import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.Objects;
import com.alveryn.api.worktype.entity.WorkType;
import com.alveryn.api.absence.entity.AbsenceTypeSetting;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "schedule_template_rules")
public class ScheduleTemplateRule extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "template_id", nullable = false)
  private ScheduleTemplate template;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "work_type_id")
  private WorkType workType;
  @Enumerated(EnumType.STRING)
  @Column(name = "item_type", nullable = false, length = 20)
  private ScheduleItemType itemType;
  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "absence_type_id")
  private AbsenceTypeSetting absenceType;
  @Column(name = "absence_type_name_snapshot", length = 80)
  private String absenceTypeNameSnapshot;
  @Column(name = "absence_type_color_snapshot", length = 7)
  private String absenceTypeColorSnapshot;

  @Column(name = "work_type_name_snapshot", length = 100)
  private String workTypeNameSnapshot;

  @Column(name = "work_type_color_snapshot", length = 7)
  private String workTypeColorSnapshot;

  @Column(name = "day_of_week", nullable = false)
  private int dayOfWeek;

  @Column(name = "start_local_time", nullable = false)
  private LocalTime startLocalTime;

  @Column(name = "end_local_time", nullable = false)
  private LocalTime endLocalTime;

  @Column(name = "break_minutes", nullable = false)
  private int breakMinutes;

  public ScheduleTemplateRule(ScheduleTemplate template, WorkType workType, DayOfWeek day, LocalTime start, LocalTime end,
      int breakMinutes) {
    this.template = Objects.requireNonNull(template);
    this.workType = Objects.requireNonNull(workType);
    this.itemType = ScheduleItemType.ACTIVITY;
    this.workTypeNameSnapshot = workType.getName();
    this.workTypeColorSnapshot = workType.getColor();
    this.dayOfWeek = Objects.requireNonNull(day).getValue();
    this.startLocalTime = Objects.requireNonNull(start);
    this.endLocalTime = Objects.requireNonNull(end);
    if (!end.isAfter(start)) throw new IllegalArgumentException("end time must be after start time");
    if (breakMinutes < 0 || breakMinutes >= java.time.Duration.between(start, end).toMinutes())
      throw new IllegalArgumentException("break must fit inside shift");
    this.breakMinutes = breakMinutes;
  }

  public ScheduleTemplateRule(ScheduleTemplate template, AbsenceTypeSetting absenceType, DayOfWeek day,
      LocalTime start, LocalTime end) {
    this.template = Objects.requireNonNull(template);
    this.itemType = ScheduleItemType.ABSENCE;
    this.absenceType = Objects.requireNonNull(absenceType);
    this.absenceTypeNameSnapshot = absenceType.getName();
    this.absenceTypeColorSnapshot = absenceType.getColor();
    this.dayOfWeek = Objects.requireNonNull(day).getValue();
    this.startLocalTime = Objects.requireNonNull(start);
    this.endLocalTime = Objects.requireNonNull(end);
    if (!end.isAfter(start)) throw new IllegalArgumentException("end time must be after start time");
    this.breakMinutes = 0;
  }

  public DayOfWeek day() {
    return DayOfWeek.of(dayOfWeek);
  }
}

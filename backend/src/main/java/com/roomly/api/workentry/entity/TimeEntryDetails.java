package com.roomly.api.workentry.entity;
import com.roomly.api.common.persistence.BaseEntity; import jakarta.persistence.*; import lombok.*; import java.time.LocalTime;
@Getter @NoArgsConstructor(access=AccessLevel.PROTECTED) @Entity @Table(name="time_entry_details")
public class TimeEntryDetails extends BaseEntity {
 @OneToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="work_entry_id",nullable=false,unique=true) private WorkEntry workEntry; @Column(name="start_time",nullable=false) private LocalTime startTime; @Column(name="end_time",nullable=false) private LocalTime endTime; @Column(name="break_minutes",nullable=false) private int breakMinutes; @Column(name="total_interval_minutes",nullable=false) private int totalIntervalMinutes;
 public TimeEntryDetails(WorkEntry e,LocalTime s,LocalTime end,int b,int total){if(b<0||total<=0||b>=total)throw new IllegalArgumentException();workEntry=java.util.Objects.requireNonNull(e);startTime=java.util.Objects.requireNonNull(s);endTime=java.util.Objects.requireNonNull(end);breakMinutes=b;totalIntervalMinutes=total;}
}

package com.roomly.api.absence.entity;
import com.roomly.api.common.persistence.BaseEntity; import com.roomly.api.user.entity.UserAccount; import jakarta.persistence.*; import lombok.*; import java.time.LocalDate;
@Getter @NoArgsConstructor(access=AccessLevel.PROTECTED) @Entity @Table(name="absences")
public class Absence extends BaseEntity {
 @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="user_id",nullable=false) private UserAccount user; @Enumerated(EnumType.STRING) @Column(name="absence_type",nullable=false,length=30) private AbsenceType absenceType; @Column(name="start_date",nullable=false) private LocalDate startDate; @Column(name="end_date",nullable=false) private LocalDate endDate; @Column(length=500) private String notes;
 public Absence(UserAccount u,AbsenceType t,LocalDate start,LocalDate end){if(start==null||end==null||end.isBefore(start))throw new IllegalArgumentException();user=java.util.Objects.requireNonNull(u);absenceType=java.util.Objects.requireNonNull(t);startDate=start;endDate=end;}
}

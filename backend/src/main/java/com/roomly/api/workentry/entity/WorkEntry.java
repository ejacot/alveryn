package com.roomly.api.workentry.entity;
import com.roomly.api.common.persistence.BaseEntity; import com.roomly.api.user.entity.UserAccount; import com.roomly.api.worktype.entity.*; import jakarta.persistence.*; import lombok.*; import java.math.BigDecimal; import java.time.LocalDate;
@Getter @NoArgsConstructor(access=AccessLevel.PROTECTED) @Entity @Table(name="work_entries")
public class WorkEntry extends BaseEntity {
 @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="user_id",nullable=false) private UserAccount user; @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="work_type_id",nullable=false) private WorkType workType;
 @Column(name="work_date",nullable=false) private LocalDate workDate; @Column(name="work_type_name_snapshot",nullable=false,length=100) private String workTypeNameSnapshot; @Enumerated(EnumType.STRING) @Column(name="calculation_method_snapshot",nullable=false,length=30) private CalculationMethod calculationMethodSnapshot;
 @Column(name="hourly_rate_snapshot",nullable=false,precision=10,scale=2) private BigDecimal hourlyRateSnapshot; @Column(name="currency_snapshot",nullable=false,length=3) private String currencySnapshot; @Column(name="calculated_minutes",nullable=false) private int calculatedMinutes;
 @Column(name="gross_amount",nullable=false,precision=12,scale=2) private BigDecimal grossAmount; @Column(length=500) private String notes;
 public WorkEntry(UserAccount u,WorkType w,LocalDate d,BigDecimal rate,String currency,int minutes,BigDecimal gross){user=java.util.Objects.requireNonNull(u);workType=java.util.Objects.requireNonNull(w);workDate=java.util.Objects.requireNonNull(d);workTypeNameSnapshot=w.getName();calculationMethodSnapshot=w.getCalculationMethod();if(rate==null||rate.signum()<0||gross==null||gross.signum()<0||minutes<=0)throw new IllegalArgumentException();hourlyRateSnapshot=rate;currencySnapshot=java.util.Objects.requireNonNull(currency);calculatedMinutes=minutes;grossAmount=gross;}
}

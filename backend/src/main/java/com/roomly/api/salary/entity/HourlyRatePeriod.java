package com.roomly.api.salary.entity;
import com.roomly.api.common.persistence.BaseEntity; import com.roomly.api.user.entity.UserAccount; import jakarta.persistence.*; import lombok.*; import java.math.BigDecimal; import java.time.LocalDate;
@Getter @NoArgsConstructor(access=AccessLevel.PROTECTED) @Entity @Table(name="hourly_rate_periods")
public class HourlyRatePeriod extends BaseEntity {
 @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="user_id",nullable=false) private UserAccount user; @Column(name="hourly_rate",nullable=false,precision=10,scale=2) private BigDecimal hourlyRate;
 @Column(nullable=false,length=3) private String currency; @Column(name="valid_from",nullable=false) private LocalDate validFrom; @Column(name="valid_to") private LocalDate validTo;
 public HourlyRatePeriod(UserAccount u,BigDecimal rate,String currency,LocalDate from,LocalDate to){user=java.util.Objects.requireNonNull(u);if(rate==null||rate.signum()<0)throw new IllegalArgumentException();hourlyRate=rate;this.currency=java.util.Objects.requireNonNull(currency);if(from==null||(to!=null&&to.isBefore(from)))throw new IllegalArgumentException();validFrom=from;validTo=to;}
}

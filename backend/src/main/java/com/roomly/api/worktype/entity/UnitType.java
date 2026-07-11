package com.roomly.api.worktype.entity;
import com.roomly.api.common.persistence.BaseEntity; import jakarta.persistence.*; import lombok.*; import java.math.BigDecimal; import java.util.Locale;
@Getter @NoArgsConstructor(access=AccessLevel.PROTECTED) @Entity @Table(name="unit_types",uniqueConstraints=@UniqueConstraint(name="uk_unit_types_work_type_name",columnNames={"work_type_id","normalized_name"}))
public class UnitType extends BaseEntity {
 @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="work_type_id",nullable=false) private WorkType workType; @Column(nullable=false,length=100) private String name; @Column(name="normalized_name",nullable=false,length=100) private String normalizedName;
 @Column(name="units_per_hour",nullable=false,precision=10,scale=4) private BigDecimal unitsPerHour; @Column(nullable=false) private boolean active=true; @Column(name="display_order",nullable=false) private int displayOrder;
 public UnitType(WorkType w,String n,BigDecimal rate){workType=java.util.Objects.requireNonNull(w);if(w.getCalculationMethod()!=CalculationMethod.UNIT_BASED)throw new IllegalArgumentException();name=n.trim();normalizedName=name.toLowerCase(Locale.ROOT);if(rate==null||rate.signum()<=0)throw new IllegalArgumentException();unitsPerHour=rate;}
}

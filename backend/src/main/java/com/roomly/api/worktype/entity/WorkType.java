package com.roomly.api.worktype.entity;
import com.roomly.api.common.persistence.BaseEntity; import com.roomly.api.user.entity.UserAccount; import jakarta.persistence.*; import lombok.*; import java.util.Locale;
@Getter @NoArgsConstructor(access=AccessLevel.PROTECTED) @Entity @Table(name="work_types",uniqueConstraints=@UniqueConstraint(name="uk_work_types_user_name",columnNames={"user_id","normalized_name"}))
public class WorkType extends BaseEntity {
 @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="user_id",nullable=false) private UserAccount user; @Column(nullable=false,length=100) private String name; @Column(name="normalized_name",nullable=false,length=100) private String normalizedName;
 @Enumerated(EnumType.STRING) @Column(name="calculation_method",nullable=false,length=30) private CalculationMethod calculationMethod; @Column(nullable=false,length=7) private String color="#87C95A"; @Column(length=100) private String icon;
 @Column(name="default_break_minutes") private Integer defaultBreakMinutes; @Column(nullable=false) private boolean active=true; @Column(name="display_order",nullable=false) private int displayOrder;
 public WorkType(UserAccount u,String n,CalculationMethod m){user=java.util.Objects.requireNonNull(u);rename(n);calculationMethod=java.util.Objects.requireNonNull(m);} public void rename(String n){if(n==null||n.trim().isEmpty())throw new IllegalArgumentException();name=n.trim();normalizedName=name.toLowerCase(Locale.ROOT);} public void setColor(String v){if(v==null||!v.matches("#[0-9A-Fa-f]{6}"))throw new IllegalArgumentException();color=v;}
}

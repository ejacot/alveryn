package com.alveryn.api.staffing.entity;

import com.alveryn.api.common.persistence.BaseEntity;
import com.alveryn.api.organization.entity.Organization;
import com.alveryn.api.organization.entity.OrganizationUnit;
import jakarta.persistence.*;
import java.time.LocalTime;
import java.math.BigDecimal;
import com.alveryn.api.worktype.entity.CalculationMethod;
import com.alveryn.api.worktype.entity.CompensationMethod;
import java.util.Objects;
import lombok.*;

@Getter @NoArgsConstructor(access = AccessLevel.PROTECTED) @Entity
@Table(name = "organization_work_types")
public class OrganizationWorkType extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "organization_id")
  private Organization organization;
  @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "unit_id") private OrganizationUnit unit;
  @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "parent_work_type_id") private OrganizationWorkType parent;
  @Column(nullable = false, length = 20) private String code;
  @Column(nullable = false, length = 120) private String name;
  @Column(nullable = false, length = 20) private String color;
  @Column(name = "default_start_time") private LocalTime defaultStartTime;
  @Column(name = "default_end_time") private LocalTime defaultEndTime;
  @Column(name = "default_break_minutes", nullable = false) private int defaultBreakMinutes;
  @Enumerated(EnumType.STRING) @Column(name="calculation_method",nullable=false,length=30) private CalculationMethod calculationMethod=CalculationMethod.TIME_BASED;
  @Enumerated(EnumType.STRING) @Column(name="compensation_method",nullable=false,length=30) private CompensationMethod compensationMethod=CompensationMethod.HOURLY;
  @Column(name="unit_label",length=100) private String unitLabel;
  @Column(name="unit_symbol",length=20) private String unitSymbol;
  @Column(name="units_per_hour",precision=12,scale=4) private BigDecimal unitsPerHour;
  @Column(name="rate_per_unit",precision=12,scale=4) private BigDecimal ratePerUnit;
  @Column(length=3) private String currency;
  @Column(name="teamwork_enabled",nullable=false) private boolean teamworkEnabled;
  @Column(name="extra_pay_enabled",nullable=false) private boolean extraPayEnabled;
  @Column(name="composite_enabled",nullable=false) private boolean compositeEnabled;
  @Column(name="display_order",nullable=false) private int displayOrder;
  @Column(nullable = false) private boolean active = true;

  public OrganizationWorkType(Organization organization, OrganizationUnit unit, String code, String name,
      String color, LocalTime start, LocalTime end, int breakMinutes) {
    this.organization = Objects.requireNonNull(organization); this.unit = unit;
    this.code = required(code, "code").toUpperCase(); this.name = required(name, "name");
    this.color = color == null || color.isBlank() ? "#10B981" : color.trim();
    this.defaultStartTime = start; this.defaultEndTime = end; this.defaultBreakMinutes = breakMinutes;
    if (breakMinutes < 0 || (end != null && start == null)) throw new IllegalArgumentException("invalid work type defaults");
  }
  public void configure(OrganizationUnit unit, OrganizationWorkType parent, String code, String name, String color,
      LocalTime start, LocalTime end, int breakMinutes, CalculationMethod calculationMethod,
      CompensationMethod compensationMethod, String unitLabel, String unitSymbol, BigDecimal unitsPerHour,
      BigDecimal ratePerUnit, String currency, boolean teamworkEnabled, boolean extraPayEnabled,
      boolean compositeEnabled, int displayOrder, boolean active) {
    if(parent!=null&&!parent.getOrganization().getId().equals(organization.getId())) throw new IllegalArgumentException("parent must belong to organization");
    if(parent!=null&&parent.getId().equals(getId())) throw new IllegalArgumentException("work type cannot be its own parent");
    if (breakMinutes < 0 || (end != null && start == null)) throw new IllegalArgumentException("invalid work type defaults");
    this.unit=unit;this.parent=parent;this.code=required(code,"code").toUpperCase();this.name=required(name,"name");
    this.color=color==null||color.isBlank()?"#10B981":color.trim();this.defaultStartTime=start;this.defaultEndTime=end;this.defaultBreakMinutes=breakMinutes;
    this.calculationMethod=Objects.requireNonNull(calculationMethod);this.compensationMethod=compensationMethod==null?CompensationMethod.HOURLY:compensationMethod;
    if(!compositeEnabled&&calculationMethod==CalculationMethod.UNITS_PER_HOUR_BASED&&(unitsPerHour==null||unitsPerHour.signum()<=0)) throw new IllegalArgumentException("units per hour is required");
    if(!compositeEnabled&&calculationMethod==CalculationMethod.UNIT_BASED&&(ratePerUnit==null||ratePerUnit.signum()<=0)) throw new IllegalArgumentException("rate per unit is required");
    this.unitLabel=blank(unitLabel);this.unitSymbol=blank(unitSymbol);this.unitsPerHour=unitsPerHour;this.ratePerUnit=ratePerUnit;this.currency=blank(currency)==null?null:currency.trim().toUpperCase();
    this.teamworkEnabled=teamworkEnabled;this.extraPayEnabled=extraPayEnabled;this.compositeEnabled=compositeEnabled;this.displayOrder=displayOrder;this.active=active;
  }
  private static String blank(String value){return value==null||value.isBlank()?null:value.trim();}
  private static String required(String value, String field) { if (value == null || value.isBlank()) throw new IllegalArgumentException(field + " is required"); return value.trim(); }
}

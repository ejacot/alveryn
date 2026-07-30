package com.alveryn.api.dataimport.entity;

import com.alveryn.api.common.persistence.BaseEntity;
import com.alveryn.api.employment.entity.Employment;
import com.alveryn.api.user.entity.UserAccount;
import jakarta.persistence.*;
import java.math.BigDecimal;
import lombok.*;

@Getter
@Entity
@Table(name = "payroll_reconciliations", uniqueConstraints = @UniqueConstraint(
    name = "uq_payroll_reconciliation_employment_period",
    columnNames = {"employment_id", "payroll_year", "payroll_month"}))
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PayrollReconciliation extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name="user_id") private UserAccount user;
  @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name="employment_id") private Employment employment;
  @Column(name="payroll_year") private int year;
  @Column(name="payroll_month") private int month;
  private String filename;
  private String status;
  @Column(name="app_worked_hours") private BigDecimal appWorkedHours;
  @Column(name="app_absence_hours") private BigDecimal appAbsenceHours;
  @Column(name="app_extra_hours") private BigDecimal appExtraHours;
  @Column(name="app_gross") private BigDecimal appGross;
  @Column(name="payroll_worked_hours") private BigDecimal payrollWorkedHours;
  @Column(name="payroll_absence_hours") private BigDecimal payrollAbsenceHours;
  @Column(name="payroll_extra_hours") private BigDecimal payrollExtraHours;
  @Column(name="payroll_gross") private BigDecimal payrollGross;
  @Column(name="payroll_lines_json", columnDefinition="text") private String payrollLinesJson;
  private String notes;

  public PayrollReconciliation(UserAccount user, Employment employment, int year, int month) {
    this.user=user; this.employment=employment; this.year=year; this.month=month;
  }

  public void update(String filename, BigDecimal appWorkedHours, BigDecimal appAbsenceHours,
      BigDecimal appExtraHours, BigDecimal appGross, BigDecimal payrollWorkedHours,
      BigDecimal payrollAbsenceHours, BigDecimal payrollExtraHours, BigDecimal payrollGross,
      String payrollLinesJson, String notes) {
    this.filename=filename; this.status="REVIEW_NEEDED";
    this.appWorkedHours=appWorkedHours; this.appAbsenceHours=appAbsenceHours;
    this.appExtraHours=appExtraHours; this.appGross=appGross;
    this.payrollWorkedHours=payrollWorkedHours; this.payrollAbsenceHours=payrollAbsenceHours;
    this.payrollExtraHours=payrollExtraHours; this.payrollGross=payrollGross;
    this.payrollLinesJson=payrollLinesJson;
    this.notes=notes == null || notes.isBlank() ? null : notes.trim();
  }
}

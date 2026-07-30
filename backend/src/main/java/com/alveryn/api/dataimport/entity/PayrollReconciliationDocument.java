package com.alveryn.api.dataimport.entity;

import com.alveryn.api.common.persistence.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

@Getter
@Entity
@Table(name = "payroll_reconciliation_documents")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PayrollReconciliationDocument extends BaseEntity {
  @OneToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "reconciliation_id", unique = true)
  private PayrollReconciliation reconciliation;

  private String filename;

  @Column(name = "content_type")
  private String contentType;

  @Column(name = "content_size")
  private long contentSize;

  @Column(columnDefinition = "bytea")
  private byte[] content;

  public PayrollReconciliationDocument(PayrollReconciliation reconciliation) {
    this.reconciliation = reconciliation;
  }

  public void replace(String filename, String contentType, byte[] content) {
    this.filename = filename;
    this.contentType = contentType;
    this.contentSize = content.length;
    this.content = content;
  }
}

package com.alveryn.api.dataimport.entity;

import com.alveryn.api.common.persistence.BaseEntity;
import com.alveryn.api.employment.entity.Employment;
import com.alveryn.api.user.entity.UserAccount;
import com.alveryn.api.worktype.entity.WorkType;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Column;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import java.text.Normalizer;
import java.util.Locale;
import java.util.Objects;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Entity
@Table(name = "data_import_work_type_mappings")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class DataImportWorkTypeMapping extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "user_id", nullable = false)
  private UserAccount user;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "employment_id", nullable = false)
  private Employment employment;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "work_type_id")
  private WorkType workType;

  @Column(name = "source_label", nullable = false, length = 100)
  private String sourceLabel;

  @Column(name = "normalized_source_label", nullable = false, length = 100)
  private String normalizedSourceLabel;

  @Enumerated(EnumType.STRING)
  @Column(name = "semantic_role", nullable = false, length = 30)
  private SemanticRole semanticRole = SemanticRole.ACTIVITY;

  @Column(name = "extra_pay_percentage", precision = 7, scale = 4)
  private BigDecimal extraPayPercentage;

  public enum SemanticRole {
    ACTIVITY,
    SURCHARGE
  }

  public DataImportWorkTypeMapping(
      UserAccount user, Employment employment, WorkType workType, String sourceLabel) {
    this.user = Objects.requireNonNull(user);
    this.employment = Objects.requireNonNull(employment);
    remap(workType, sourceLabel);
  }

  public void remap(WorkType target, String label) {
    workType = Objects.requireNonNull(target);
    semanticRole = SemanticRole.ACTIVITY;
    extraPayPercentage = null;
    setLabel(label);
  }

  public static DataImportWorkTypeMapping surcharge(
      UserAccount user,
      Employment employment,
      WorkType target,
      String sourceLabel,
      BigDecimal percentage) {
    if (percentage == null || percentage.signum() <= 0
        || percentage.compareTo(BigDecimal.valueOf(1000)) > 0) {
      throw new IllegalArgumentException("Extra pay percentage must be between 1 and 1000");
    }
    var mapping = new DataImportWorkTypeMapping();
    mapping.user = Objects.requireNonNull(user);
    mapping.employment = Objects.requireNonNull(employment);
    mapping.workType = target;
    mapping.semanticRole = SemanticRole.SURCHARGE;
    mapping.extraPayPercentage = percentage.stripTrailingZeros();
    mapping.setLabel(sourceLabel);
    return mapping;
  }

  public void remapSurcharge(WorkType target, String label, BigDecimal percentage) {
    if (percentage == null || percentage.signum() <= 0
        || percentage.compareTo(BigDecimal.valueOf(1000)) > 0) {
      throw new IllegalArgumentException("Extra pay percentage must be between 1 and 1000");
    }
    workType = target;
    semanticRole = SemanticRole.SURCHARGE;
    extraPayPercentage = percentage.stripTrailingZeros();
    setLabel(label);
  }

  private void setLabel(String label) {
    sourceLabel = Objects.requireNonNull(label).strip();
    normalizedSourceLabel = normalize(sourceLabel);
  }

  public static String normalize(String value) {
    return Normalizer.normalize(value, Normalizer.Form.NFD)
        .replaceAll("\\p{M}", "")
        .toLowerCase(Locale.ROOT)
        .replaceAll("[^a-z0-9]+", " ")
        .strip();
  }
}

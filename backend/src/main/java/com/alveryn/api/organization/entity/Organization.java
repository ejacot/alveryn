package com.alveryn.api.organization.entity;

import com.alveryn.api.common.persistence.BaseEntity;
import com.alveryn.api.user.entity.UserAccount;
import jakarta.persistence.*;
import java.time.ZoneId;
import java.util.Objects;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "organizations")
public class Organization extends BaseEntity {
  @OneToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "personal_owner_user_id", unique = true)
  private UserAccount personalOwner;

  @Column(nullable = false, length = 160)
  private String name;

  @Enumerated(EnumType.STRING)
  @Column(name = "organization_type", nullable = false, length = 20)
  private OrganizationType organizationType;

  @Column(nullable = false, length = 60)
  private String timezone;

  public Organization(UserAccount owner, String name, String timezone) {
    this.personalOwner = Objects.requireNonNull(owner, "owner is required");
    this.name = required(name, "name");
    this.organizationType = OrganizationType.PERSONAL;
    this.timezone = validTimezone(timezone);
  }

  private static String required(String value, String field) {
    if (value == null || value.isBlank()) throw new IllegalArgumentException(field + " is required");
    return value.trim();
  }

  private static String validTimezone(String value) {
    String candidate = value == null || value.isBlank() ? "UTC" : value.trim();
    ZoneId.of(candidate);
    return candidate;
  }
}

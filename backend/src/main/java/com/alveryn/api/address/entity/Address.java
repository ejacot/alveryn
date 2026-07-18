package com.alveryn.api.address.entity;

import com.alveryn.api.common.persistence.BaseEntity;
import com.alveryn.api.user.entity.UserAccount;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.util.Locale;
import java.util.Objects;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "addresses")
public class Address extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "user_id", nullable = false)
  private UserAccount user;

  @Column(nullable = false, length = 150)
  private String street;

  @Column(name = "street_2", length = 150)
  private String street2;

  @Column(name = "postal_code", length = 30)
  private String postalCode;

  @Column(nullable = false, length = 100)
  private String city;

  @Column(length = 100)
  private String region;

  @Column(nullable = false, length = 2)
  private String country;

  public Address(UserAccount user, String street, String street2, String postalCode, String city, String region, String country) {
    this.user = Objects.requireNonNull(user, "user is required");
    update(street, street2, postalCode, city, region, country);
  }

  public void update(String street, String street2, String postalCode, String city, String region, String country) {
    this.street = require(street, "street", 150);
    this.street2 = optional(street2, 150);
    this.postalCode = optional(postalCode, 30);
    this.city = require(city, "city", 100);
    this.region = optional(region, 100);
    this.country = normalizeCountry(country);
  }

  private static String require(String value, String field, int maxLength) {
    String normalized = optional(value, maxLength);
    if (normalized == null) {
      throw new IllegalArgumentException(field + " is required");
    }
    return normalized;
  }

  private static String optional(String value, int maxLength) {
    if (value == null) {
      return null;
    }
    String normalized = value.trim();
    if (normalized.isEmpty()) {
      return null;
    }
    if (normalized.length() > maxLength) {
      throw new IllegalArgumentException("address field is too long");
    }
    return normalized;
  }

  private static String normalizeCountry(String value) {
    String normalized = require(value, "country", 2).toUpperCase(Locale.ROOT);
    if (!normalized.matches("[A-Z]{2}")) {
      throw new IllegalArgumentException("country must be a two-letter code");
    }
    return normalized;
  }
}

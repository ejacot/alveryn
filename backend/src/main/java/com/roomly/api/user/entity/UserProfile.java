package com.roomly.api.user.entity;

import com.roomly.api.common.persistence.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.util.Objects;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "user_profiles")
public class UserProfile extends BaseEntity {
  @OneToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "user_id", nullable = false, unique = true)
  private UserAccount user;

  @Column(name = "first_name", length = 80)
  private String firstName;

  @Column(name = "last_name", length = 80)
  private String lastName;

  @Column(name = "display_name", length = 100)
  private String displayName;

  @Column(name = "date_of_birth")
  private LocalDate dateOfBirth;

  @Column(length = 30)
  private String phone;

  @Column(name = "country_code", length = 2)
  private String countryCode;

  @Column(length = 100)
  private String city;

  @Column(name = "postal_code", length = 20)
  private String postalCode;

  @Column(length = 150)
  private String street;

  @Column(name = "house_number", length = 30)
  private String houseNumber;

  @Column(length = 30)
  private String apartment;

  @Column(name = "avatar_url", length = 500)
  private String avatarUrl;

  @Column(name = "employment_start_date")
  private LocalDate employmentStartDate;

  @Column(name = "employment_end_date")
  private LocalDate employmentEndDate;

  public UserProfile(UserAccount user) {
    this.user = Objects.requireNonNull(user, "user is required");
  }

  public void updateEmploymentDates(LocalDate start, LocalDate end) {
    if (start != null && end != null && end.isBefore(start))
      throw new IllegalArgumentException("employmentEndDate cannot precede employmentStartDate");
    employmentStartDate = start;
    employmentEndDate = end;
  }

  public void updateDetails(
      String firstName,
      String lastName,
      String displayName,
      LocalDate dateOfBirth,
      String phone,
      String countryCode,
      String city,
      String postalCode,
      String street,
      String houseNumber,
      String apartment,
      String avatarUrl) {
    this.firstName = firstName;
    this.lastName = lastName;
    this.displayName = displayName;
    this.dateOfBirth = dateOfBirth;
    this.phone = phone;
    this.countryCode = countryCode;
    this.city = city;
    this.postalCode = postalCode;
    this.street = street;
    this.houseNumber = houseNumber;
    this.apartment = apartment;
    this.avatarUrl = avatarUrl;
  }
}

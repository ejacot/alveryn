package com.alveryn.api.salary.repository;

import com.alveryn.api.salary.entity.HourlyRatePeriod;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface HourlyRatePeriodRepository extends JpaRepository<HourlyRatePeriod, UUID> {
  java.util.List<HourlyRatePeriod> findAllByUserIdOrderByValidFromDesc(UUID userId);
  java.util.List<HourlyRatePeriod> findAllByUserIdOrderByEmploymentDisplayOrderAscValidFromDesc(UUID userId);

  Optional<HourlyRatePeriod> findByIdAndUserId(UUID id, UUID userId);

  boolean existsByUserId(UUID userId);

  @Query(
      """
      select count(h) > 0 from HourlyRatePeriod h
      where h.user.id = :userId
        and h.employment.active = true
        and h.employment.trackingFocus = com.alveryn.api.employment.entity.TrackingFocus.EARNINGS
      """)
  boolean existsForActiveEarningsEmployment(@Param("userId") UUID userId);

  @Query(
      """
      select h from HourlyRatePeriod h
      where h.user.id = :userId and h.employment.id = :employmentId
        and h.validFrom <= :date
        and (h.validTo is null or h.validTo >= :date)
      """)
  Optional<HourlyRatePeriod> findValidForDate(
      @Param("userId") UUID userId, @Param("employmentId") UUID employmentId, @Param("date") LocalDate date);

  @Query(
      """
      select count(h) > 0 from HourlyRatePeriod h
      where h.user.id = :userId and h.employment.id = :employmentId
        and h.validFrom <= :validTo
        and (h.validTo is null or h.validTo >= :validFrom)
      """)
  boolean existsOverlappingClosed(
      @Param("userId") UUID userId,
      @Param("employmentId") UUID employmentId,
      @Param("validFrom") LocalDate validFrom,
      @Param("validTo") LocalDate validTo);

  @Query(
      """
      select count(h) > 0 from HourlyRatePeriod h
      where h.user.id = :userId and h.employment.id = :employmentId
        and (h.validTo is null or h.validTo >= :validFrom)
      """)
  boolean existsOverlappingOpenEnded(
      @Param("userId") UUID userId, @Param("employmentId") UUID employmentId, @Param("validFrom") LocalDate validFrom);

  @Query(
      "select count(h)>0 from HourlyRatePeriod h where h.user.id=:userId and h.employment.id=:employmentId and h.id<>:excludedId and"
          + " h.validFrom<=:validTo and (h.validTo is null or h.validTo>=:validFrom)")
  boolean existsOverlappingClosedExcluding(
      UUID userId, UUID employmentId, LocalDate validFrom, LocalDate validTo, UUID excludedId);

  @Query(
      "select count(h)>0 from HourlyRatePeriod h where h.user.id=:userId and h.employment.id=:employmentId and h.id<>:excludedId and"
          + " (h.validTo is null or h.validTo>=:validFrom)")
  boolean existsOverlappingOpenEndedExcluding(UUID userId, UUID employmentId, LocalDate validFrom, UUID excludedId);
}

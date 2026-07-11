package com.roomly.api.salary.repository;

import com.roomly.api.salary.entity.HourlyRatePeriod;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface HourlyRatePeriodRepository extends JpaRepository<HourlyRatePeriod, UUID> {
  java.util.List<HourlyRatePeriod> findAllByUserIdOrderByValidFromDesc(UUID userId);

  Optional<HourlyRatePeriod> findByIdAndUserId(UUID id, UUID userId);

  @Query(
      """
      select h from HourlyRatePeriod h
      where h.user.id = :userId
        and h.validFrom <= :date
        and (h.validTo is null or h.validTo >= :date)
      """)
  Optional<HourlyRatePeriod> findValidForDate(
      @Param("userId") UUID userId, @Param("date") LocalDate date);

  @Query(
      """
      select count(h) > 0 from HourlyRatePeriod h
      where h.user.id = :userId
        and h.validFrom <= :validTo
        and (h.validTo is null or h.validTo >= :validFrom)
      """)
  boolean existsOverlappingClosed(
      @Param("userId") UUID userId,
      @Param("validFrom") LocalDate validFrom,
      @Param("validTo") LocalDate validTo);

  @Query(
      """
      select count(h) > 0 from HourlyRatePeriod h
      where h.user.id = :userId
        and (h.validTo is null or h.validTo >= :validFrom)
      """)
  boolean existsOverlappingOpenEnded(
      @Param("userId") UUID userId, @Param("validFrom") LocalDate validFrom);

  @Query(
      "select count(h)>0 from HourlyRatePeriod h where h.user.id=:userId and h.id<>:excludedId and"
          + " h.validFrom<=:validTo and (h.validTo is null or h.validTo>=:validFrom)")
  boolean existsOverlappingClosedExcluding(
      UUID userId, LocalDate validFrom, LocalDate validTo, UUID excludedId);

  @Query(
      "select count(h)>0 from HourlyRatePeriod h where h.user.id=:userId and h.id<>:excludedId and"
          + " (h.validTo is null or h.validTo>=:validFrom)")
  boolean existsOverlappingOpenEndedExcluding(UUID userId, LocalDate validFrom, UUID excludedId);
}

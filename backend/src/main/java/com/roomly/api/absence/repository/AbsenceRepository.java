package com.roomly.api.absence.repository;

import com.roomly.api.absence.entity.Absence;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface AbsenceRepository extends JpaRepository<Absence, UUID>, JpaSpecificationExecutor<Absence> {
  List<Absence> findAllByUserIdAndStartDateLessThanEqualAndEndDateGreaterThanEqual(
      UUID userId, LocalDate rangeEnd, LocalDate rangeStart);

  Optional<Absence> findByIdAndUserId(UUID id, UUID userId);

  boolean existsByUserIdAndStartDateLessThanEqualAndEndDateGreaterThanEqual(
      UUID userId, LocalDate rangeEnd, LocalDate rangeStart);

  boolean existsByUserIdAndStartDateLessThanEqualAndEndDateGreaterThanEqualAndIdNot(
      UUID userId, LocalDate rangeEnd, LocalDate rangeStart, UUID id);
}

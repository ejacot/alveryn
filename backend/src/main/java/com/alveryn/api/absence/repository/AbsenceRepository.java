package com.alveryn.api.absence.repository;

import com.alveryn.api.absence.entity.Absence;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

public interface AbsenceRepository extends JpaRepository<Absence, UUID>, JpaSpecificationExecutor<Absence> {
  List<Absence> findAllByUserIdAndStartDateLessThanEqualAndEndDateGreaterThanEqual(
      UUID userId, LocalDate rangeEnd, LocalDate rangeStart);

  Optional<Absence> findByIdAndUserId(UUID id, UUID userId);

  boolean existsByUserIdAndStartDateLessThanEqualAndEndDateGreaterThanEqual(
      UUID userId, LocalDate rangeEnd, LocalDate rangeStart);

  boolean existsByUserIdAndStartDateLessThanEqualAndEndDateGreaterThanEqualAndIdNot(
      UUID userId, LocalDate rangeEnd, LocalDate rangeStart, UUID id);

  @Query("select min(absence.startDate) from Absence absence where absence.user.id = :userId")
  LocalDate findEarliestStartDateByUserId(UUID userId);

  List<Absence> findAllByUserIdAndImportSourceKeyIn(UUID userId, Collection<String> importSourceKeys);

  List<Absence> findAllByImportBatchId(UUID importBatchId);
}

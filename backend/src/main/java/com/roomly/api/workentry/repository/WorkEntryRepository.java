package com.roomly.api.workentry.repository;

import com.roomly.api.workentry.entity.WorkEntry;
import java.util.List;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WorkEntryRepository extends JpaRepository<WorkEntry, UUID> {
  @EntityGraph(attributePaths = "workType")
  List<WorkEntry> findAllByUserIdAndWorkDateOrderByCreatedAt(UUID userId, LocalDate workDate);

  @EntityGraph(attributePaths = "workType")
  List<WorkEntry> findAllByUserIdAndWorkDateBetweenOrderByWorkDateAscCreatedAtAsc(
      UUID userId, LocalDate fromDate, LocalDate toDate);

  @EntityGraph(attributePaths = "workType")
  Optional<WorkEntry> findByIdAndUserId(UUID id, UUID userId);

  @EntityGraph(attributePaths = "workType")
  Page<WorkEntry> findAllByUserId(UUID userId, Pageable pageable);

  @EntityGraph(attributePaths = "workType")
  Page<WorkEntry> findAllByUserIdAndWorkDateBetween(
      UUID userId, LocalDate fromDate, LocalDate toDate, Pageable pageable);

  @EntityGraph(attributePaths = "workType")
  Page<WorkEntry> findAllByUserIdAndWorkTypeId(UUID userId, UUID workTypeId, Pageable pageable);

  @EntityGraph(attributePaths = "workType")
  Page<WorkEntry> findAllByUserIdAndWorkTypeIdAndWorkDateBetween(
      UUID userId, UUID workTypeId, LocalDate fromDate, LocalDate toDate, Pageable pageable);
}

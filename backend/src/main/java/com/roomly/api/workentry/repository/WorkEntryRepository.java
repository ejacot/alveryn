package com.roomly.api.workentry.repository;

import com.roomly.api.workentry.entity.WorkEntry;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WorkEntryRepository extends JpaRepository<WorkEntry, UUID> {
  List<WorkEntry> findAllByUserIdAndWorkDateOrderByCreatedAt(UUID userId, LocalDate workDate);

  Optional<WorkEntry> findByIdAndUserId(UUID id, UUID userId);

  Page<WorkEntry> findAllByUserId(UUID userId, Pageable pageable);

  Page<WorkEntry> findAllByUserIdAndWorkDateBetween(
      UUID userId, LocalDate fromDate, LocalDate toDate, Pageable pageable);

  Page<WorkEntry> findAllByUserIdAndWorkTypeId(UUID userId, UUID workTypeId, Pageable pageable);

  Page<WorkEntry> findAllByUserIdAndWorkTypeIdAndWorkDateBetween(
      UUID userId, UUID workTypeId, LocalDate fromDate, LocalDate toDate, Pageable pageable);
}

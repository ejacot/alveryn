package com.roomly.api.workentry.repository;

import com.roomly.api.workentry.entity.WorkEntry;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WorkEntryRepository extends JpaRepository<WorkEntry, UUID> {
  List<WorkEntry> findAllByUserIdAndWorkDateOrderByCreatedAt(UUID userId, LocalDate workDate);
}

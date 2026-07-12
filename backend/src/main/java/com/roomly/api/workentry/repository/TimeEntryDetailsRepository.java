package com.roomly.api.workentry.repository;

import com.roomly.api.workentry.entity.TimeEntryDetails;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TimeEntryDetailsRepository extends JpaRepository<TimeEntryDetails, UUID> {
  Optional<TimeEntryDetails> findByWorkEntryId(UUID workEntryId);

  void deleteByWorkEntryId(UUID workEntryId);
}

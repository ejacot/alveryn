package com.roomly.api.workentry.repository;

import com.roomly.api.workentry.entity.TimeEntryDetails;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TimeEntryDetailsRepository extends JpaRepository<TimeEntryDetails, UUID> {
  Optional<TimeEntryDetails> findByWorkEntryId(UUID workEntryId);

  List<TimeEntryDetails> findAllByWorkEntryIdIn(Collection<UUID> workEntryIds);

  void deleteByWorkEntryId(UUID workEntryId);
}

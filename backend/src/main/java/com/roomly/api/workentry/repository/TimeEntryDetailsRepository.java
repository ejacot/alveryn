package com.roomly.api.workentry.repository;

import com.roomly.api.workentry.entity.TimeEntryDetails;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface TimeEntryDetailsRepository extends JpaRepository<TimeEntryDetails, UUID> {
  Optional<TimeEntryDetails> findByWorkEntryId(UUID workEntryId);

  List<TimeEntryDetails> findAllByWorkEntryIdIn(Collection<UUID> workEntryIds);

  @Query(
      """
      select detail
      from TimeEntryDetails detail
        join fetch detail.workEntry entry
        join fetch entry.workType
      where entry.user.id = :userId
      """)
  List<TimeEntryDetails> findAllForUserWithEntryAndWorkType(UUID userId);

  @Query(
      """
      select detail
      from TimeEntryDetails detail
        join fetch detail.workEntry entry
        join fetch entry.workType
      where entry.user.id = :userId
        and entry.workDate between :fromDate and :toDate
      """)
  List<TimeEntryDetails> findPotentialOverlapsForUser(
      UUID userId, LocalDate fromDate, LocalDate toDate);

  void deleteByWorkEntryId(UUID workEntryId);
}

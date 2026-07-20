package com.alveryn.api.workrecord.repository;

import com.alveryn.api.workrecord.entity.WorkRecord;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WorkRecordRepository extends JpaRepository<WorkRecord, UUID> {
  Optional<WorkRecord> findByIdAndUserId(UUID id, UUID userId);

  List<WorkRecord> findAllByUserIdAndWorkDateOrderByCreatedAtAsc(UUID userId, LocalDate workDate);

  @Query("""
      select record from WorkRecord record
      where record.user.id = :userId
        and record.workDate <= :toDate
        and coalesce(record.workEndDate, record.workDate) >= :fromDate
      order by record.workDate asc, record.createdAt asc
      """)
  List<WorkRecord> findAllOverlappingRange(
      @Param("userId") UUID userId,
      @Param("fromDate") LocalDate fromDate,
      @Param("toDate") LocalDate toDate);

  boolean existsByUserIdAndWorkDateBetween(UUID userId, LocalDate fromDate, LocalDate toDate);
  boolean existsByUserIdAndEmploymentIdAndWorkDateBetween(
      UUID userId, UUID employmentId, LocalDate fromDate, LocalDate toDate);
  boolean existsByEmploymentId(UUID employmentId);
  long countByProjectId(UUID projectId);
  boolean existsByProjectId(UUID projectId);

  @Query("select min(record.workDate) from WorkRecord record where record.user.id = :userId")
  LocalDate findEarliestWorkDateByUserId(@Param("userId") UUID userId);
}

package com.alveryn.api.workrecord.line.repository;

import com.alveryn.api.workrecord.line.entity.WorkRecordLine;
import com.alveryn.api.workrecord.line.entity.WorkLineCalculationMode;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import java.math.BigDecimal;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WorkRecordLineRepository extends JpaRepository<WorkRecordLine, UUID> {
  List<WorkRecordLine> findAllByWorkRecordIdOrderByDisplayOrderAscCreatedAtAsc(UUID workRecordId);

  List<WorkRecordLine> findAllByWorkRecordIdIn(Collection<UUID> workRecordIds);

  void deleteAllByWorkRecordId(UUID workRecordId);

  boolean existsByWorkRecordUserIdAndWorkTypeId(UUID userId, UUID workTypeId);

  @Query(
      """
      select distinct line.workType.id
      from WorkRecordLine line
      where line.workRecord.user.id = :userId
      """)
  List<UUID> findUsedWorkTypeIdsByUserId(@Param("userId") UUID userId);

  @Query("""
      select coalesce(sum(line.calculatedMinutes), 0)
      from WorkRecordLine line
      where line.workRecord.employment.id = :employmentId
        and line.workRecord.workDate between :fromDate and :toDate
        and line.calculationModeSnapshot = com.alveryn.api.workrecord.line.entity.WorkLineCalculationMode.TIME_ONLY
      """)
  BigDecimal sumTimeOnlyMinutes(@Param("employmentId") UUID employmentId,
      @Param("fromDate") LocalDate fromDate, @Param("toDate") LocalDate toDate);

  @Query(
      """
      select line
      from WorkRecordLine line
      join fetch line.workRecord record
      join fetch line.workType workType
      where record.user.id = :userId
        and record.workDate between :fromDate and :toDate
        and (:workTypeIdsEmpty = true or workType.id in :workTypeIds)
        and (
          :methodsEmpty = true
          or (:timeBasedSelected = true and line.calculationModeSnapshot = com.alveryn.api.workrecord.line.entity.WorkLineCalculationMode.TIME_HOURLY)
          or (:unitBasedSelected = true and line.calculationModeSnapshot in :unitModes)
          or (:fixedPriceSelected = true and line.calculationModeSnapshot = com.alveryn.api.workrecord.line.entity.WorkLineCalculationMode.FIXED_AMOUNT)
        )
      order by record.workDate asc, record.createdAt asc, line.displayOrder asc, line.createdAt asc
      """)
  List<WorkRecordLine> findFilteredForStatistics(
      @Param("userId") UUID userId,
      @Param("fromDate") LocalDate fromDate,
      @Param("toDate") LocalDate toDate,
      @Param("workTypeIds") Collection<UUID> workTypeIds,
      @Param("workTypeIdsEmpty") boolean workTypeIdsEmpty,
      @Param("methodsEmpty") boolean methodsEmpty,
      @Param("timeBasedSelected") boolean timeBasedSelected,
      @Param("unitBasedSelected") boolean unitBasedSelected,
      @Param("fixedPriceSelected") boolean fixedPriceSelected,
      @Param("unitModes") Collection<WorkLineCalculationMode> unitModes);
}

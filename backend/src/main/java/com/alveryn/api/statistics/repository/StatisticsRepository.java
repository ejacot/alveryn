package com.alveryn.api.statistics.repository;

import com.alveryn.api.workentry.entity.WorkEntry;
import com.alveryn.api.worktype.entity.CalculationMethod;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StatisticsRepository extends JpaRepository<WorkEntry, UUID> {
  @EntityGraph(attributePaths = "workType")
  @Query(
      """
      select entry
      from WorkEntry entry
      where entry.user.id = :userId
        and entry.workDate between :fromDate and :toDate
        and (:workTypeIdsEmpty = true or entry.workType.id in :workTypeIds)
        and (:methodsEmpty = true or entry.calculationMethodSnapshot in :calculationMethods)
      order by entry.workDate asc, entry.createdAt asc
      """)
  List<WorkEntry> findFiltered(
      @Param("userId") UUID userId,
      @Param("fromDate") LocalDate fromDate,
      @Param("toDate") LocalDate toDate,
      @Param("workTypeIds") Collection<UUID> workTypeIds,
      @Param("workTypeIdsEmpty") boolean workTypeIdsEmpty,
      @Param("calculationMethods") Collection<CalculationMethod> calculationMethods,
      @Param("methodsEmpty") boolean methodsEmpty);
}

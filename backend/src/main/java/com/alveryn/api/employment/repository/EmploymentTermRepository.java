package com.alveryn.api.employment.repository;

import com.alveryn.api.employment.entity.EmploymentTerm;
import java.time.LocalDate;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EmploymentTermRepository extends JpaRepository<EmploymentTerm, UUID> {
  List<EmploymentTerm> findAllByEmploymentIdOrderByValidFromAsc(UUID employmentId);
  Optional<EmploymentTerm> findFirstByEmploymentIdOrderByValidFromDesc(UUID employmentId);
  Optional<EmploymentTerm> findByEmploymentIdAndValidFrom(UUID employmentId, LocalDate validFrom);
  @Query("select t from EmploymentTerm t where t.employment.id = :employmentId and t.validFrom <= :date and (t.validTo is null or t.validTo >= :date) order by t.validFrom desc")
  List<EmploymentTerm> findEffective(@Param("employmentId") UUID employmentId, @Param("date") LocalDate date);
}

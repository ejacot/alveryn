package com.alveryn.api.dataimport.repository;
import com.alveryn.api.dataimport.entity.PayrollReconciliation;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
public interface PayrollReconciliationRepository extends JpaRepository<PayrollReconciliation, UUID> {
  Optional<PayrollReconciliation> findByEmploymentIdAndYearAndMonth(UUID employmentId, int year, int month);
}

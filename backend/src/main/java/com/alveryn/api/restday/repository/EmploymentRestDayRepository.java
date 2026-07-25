package com.alveryn.api.restday.repository;

import com.alveryn.api.restday.entity.EmploymentRestDay;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EmploymentRestDayRepository extends JpaRepository<EmploymentRestDay, UUID> {
  List<EmploymentRestDay> findAllByEmploymentIdAndDateBetweenOrderByDate(
      UUID employmentId, LocalDate from, LocalDate to);

  Optional<EmploymentRestDay> findByEmploymentIdAndDate(UUID employmentId, LocalDate date);

  boolean existsByEmploymentIdAndDateBetween(
      UUID employmentId, LocalDate from, LocalDate to);
}

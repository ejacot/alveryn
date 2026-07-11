package com.roomly.api.absence.repository;

import com.roomly.api.absence.entity.Absence;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AbsenceRepository extends JpaRepository<Absence, UUID> {
  List<Absence> findAllByUserIdAndStartDateLessThanEqualAndEndDateGreaterThanEqual(
      UUID userId, LocalDate rangeEnd, LocalDate rangeStart);
}

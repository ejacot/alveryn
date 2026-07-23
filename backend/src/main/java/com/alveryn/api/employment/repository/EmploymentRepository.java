package com.alveryn.api.employment.repository;

import com.alveryn.api.employment.entity.Employment;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EmploymentRepository extends JpaRepository<Employment, UUID> {
  List<Employment> findAllByUserIdOrderByDisplayOrderAscNameAsc(UUID userId);
  Optional<Employment> findByIdAndUserId(UUID id, UUID userId);
  Optional<Employment> findFirstByUserIdAndActiveTrueOrderByDisplayOrderAscNameAsc(UUID userId);
  boolean existsByUserIdAndActiveTrue(UUID userId);
  boolean existsByUserIdAndActiveTrueAndTrackingFocus(UUID userId, com.alveryn.api.employment.entity.TrackingFocus trackingFocus);
  boolean existsByUserIdAndActiveTrueAndCompensationType(UUID userId, com.alveryn.api.employment.entity.CompensationType compensationType);
}

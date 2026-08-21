package com.alveryn.api.staffing.repository;
import com.alveryn.api.staffing.entity.StaffingMemberDayEntry;
import java.time.LocalDate;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
public interface StaffingMemberDayEntryRepository extends JpaRepository<StaffingMemberDayEntry, UUID> {
  List<StaffingMemberDayEntry> findAllByOrganizationIdAndDateBetweenOrderByDateAsc(UUID organizationId, LocalDate from, LocalDate to);
  List<StaffingMemberDayEntry> findAllByOrganizationIdAndMembershipIdAndDateBetweenOrderByDateAsc(
      UUID organizationId, UUID membershipId, LocalDate from, LocalDate to);
  Optional<StaffingMemberDayEntry> findByOrganizationIdAndMembershipIdAndDate(UUID organizationId, UUID membershipId, LocalDate date);
}

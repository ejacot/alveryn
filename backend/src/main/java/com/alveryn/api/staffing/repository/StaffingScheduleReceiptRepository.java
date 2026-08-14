package com.alveryn.api.staffing.repository;
import com.alveryn.api.staffing.entity.StaffingScheduleReceipt;
import java.time.LocalDate;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
public interface StaffingScheduleReceiptRepository extends JpaRepository<StaffingScheduleReceipt,UUID>{
  Optional<StaffingScheduleReceipt> findByOrganizationIdAndMembershipIdAndWeekStart(
      UUID organizationId, UUID membershipId, LocalDate weekStart);
  @Query("""
      select receipt from StaffingScheduleReceipt receipt
      join fetch receipt.organization
      join fetch receipt.membership
      where receipt.organization.id in :organizationIds
        and receipt.membership.id in :membershipIds
        and receipt.weekStart in :weekStarts
      """)
  List<StaffingScheduleReceipt> findAllForScopes(
      @Param("organizationIds") Collection<UUID> organizationIds,
      @Param("membershipIds") Collection<UUID> membershipIds,
      @Param("weekStarts") Collection<LocalDate> weekStarts);
}

package com.alveryn.api.staffing.repository;
import com.alveryn.api.staffing.entity.StaffingScheduleReceipt;
import java.time.LocalDate;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
public interface StaffingScheduleReceiptRepository extends JpaRepository<StaffingScheduleReceipt,UUID>{ Optional<StaffingScheduleReceipt> findByOrganizationIdAndMembershipIdAndWeekStart(UUID organizationId,UUID membershipId,LocalDate weekStart); }

package com.alveryn.api.staffing.repository;
import com.alveryn.api.staffing.entity.StaffingAbsenceRequest;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
public interface StaffingAbsenceRequestRepository extends JpaRepository<StaffingAbsenceRequest,UUID>{
 List<StaffingAbsenceRequest> findAllByMembershipUserIdOrderByCreatedAtDesc(UUID userId);
 List<StaffingAbsenceRequest> findAllByOrganizationIdAndStatusOrderByCreatedAtAsc(UUID organizationId,String status);
}

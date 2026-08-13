package com.alveryn.api.staffing.repository;
import com.alveryn.api.staffing.entity.StaffingChangeEvent;
import java.util.*;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
public interface StaffingChangeEventRepository extends JpaRepository<StaffingChangeEvent,UUID>{List<StaffingChangeEvent> findAllByOrganizationIdOrderByCreatedAtDesc(UUID organizationId,Pageable pageable);}

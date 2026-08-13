package com.alveryn.api.organization.repository;

import com.alveryn.api.organization.entity.OrganizationRoleAssignment;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrganizationRoleAssignmentRepository
    extends JpaRepository<OrganizationRoleAssignment, UUID> {
  List<OrganizationRoleAssignment> findAllByMembershipOrganizationIdOrderByCreatedAtAsc(UUID organizationId);
  List<OrganizationRoleAssignment> findAllByMembershipId(UUID membershipId);
}

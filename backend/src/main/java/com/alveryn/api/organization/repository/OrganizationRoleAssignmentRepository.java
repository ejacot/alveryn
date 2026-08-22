package com.alveryn.api.organization.repository;

import com.alveryn.api.organization.entity.OrganizationRoleAssignment;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OrganizationRoleAssignmentRepository
    extends JpaRepository<OrganizationRoleAssignment, UUID> {
  List<OrganizationRoleAssignment> findAllByMembershipOrganizationIdOrderByCreatedAtAsc(UUID organizationId);
  List<OrganizationRoleAssignment> findAllByMembershipId(UUID membershipId);
  java.util.Optional<OrganizationRoleAssignment> findByIdAndMembershipOrganizationId(
      UUID id, UUID organizationId);
  List<OrganizationRoleAssignment> findAllByRoleId(UUID roleId);

  @Query("""
      select assignment from OrganizationRoleAssignment assignment
      join fetch assignment.role
      left join fetch assignment.unit unit
      left join fetch unit.parent
      where assignment.membership.id = :membershipId
      """)
  List<OrganizationRoleAssignment> findAllForAccessCheck(
      @Param("membershipId") UUID membershipId);
}

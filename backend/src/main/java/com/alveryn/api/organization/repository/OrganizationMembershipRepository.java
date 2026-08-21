package com.alveryn.api.organization.repository;

import com.alveryn.api.organization.entity.OrganizationMembership;
import java.util.Optional;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrganizationMembershipRepository extends JpaRepository<OrganizationMembership, UUID> {
  Optional<OrganizationMembership> findByOrganizationIdAndUserId(UUID organizationId, UUID userId);
  List<OrganizationMembership> findAllByUserIdAndStatusOrderByCreatedAtAsc(UUID userId,
      com.alveryn.api.organization.entity.MembershipStatus status);
  List<OrganizationMembership> findAllByOrganizationIdOrderByCreatedAtAsc(UUID organizationId);
  Optional<OrganizationMembership> findByIdAndOrganizationId(UUID id, UUID organizationId);
  List<OrganizationMembership> findAllByInvitedEmailIgnoreCaseAndStatus(String email,
      com.alveryn.api.organization.entity.MembershipStatus status);
}

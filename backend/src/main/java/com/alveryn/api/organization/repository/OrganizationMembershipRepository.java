package com.alveryn.api.organization.repository;

import com.alveryn.api.organization.entity.OrganizationMembership;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrganizationMembershipRepository extends JpaRepository<OrganizationMembership, UUID> {
  Optional<OrganizationMembership> findByOrganizationIdAndUserId(UUID organizationId, UUID userId);
}

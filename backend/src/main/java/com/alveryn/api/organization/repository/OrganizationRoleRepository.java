package com.alveryn.api.organization.repository;

import com.alveryn.api.organization.entity.OrganizationRole;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrganizationRoleRepository extends JpaRepository<OrganizationRole, UUID> {
  List<OrganizationRole> findAllByOrganizationIdOrderByNameAsc(UUID organizationId);
  Optional<OrganizationRole> findByIdAndOrganizationId(UUID id, UUID organizationId);
}

package com.alveryn.api.organization.repository;

import com.alveryn.api.organization.entity.OrganizationUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrganizationUnitRepository extends JpaRepository<OrganizationUnit, UUID> {
  List<OrganizationUnit> findAllByOrganizationIdOrderByDisplayOrderAscNameAsc(UUID organizationId);
  Optional<OrganizationUnit> findByIdAndOrganizationId(UUID id, UUID organizationId);
}

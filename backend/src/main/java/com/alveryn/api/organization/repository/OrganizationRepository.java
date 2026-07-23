package com.alveryn.api.organization.repository;

import com.alveryn.api.organization.entity.Organization;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrganizationRepository extends JpaRepository<Organization, UUID> {
  Optional<Organization> findByPersonalOwnerId(UUID userId);
}

package com.alveryn.api.organization.repository;

import com.alveryn.api.organization.entity.Organization;
import java.util.Optional;
import java.util.UUID;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OrganizationRepository extends JpaRepository<Organization, UUID> {
  Optional<Organization> findByPersonalOwnerId(UUID userId);

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select organization from Organization organization where organization.id = :id")
  Optional<Organization> lockById(@Param("id") UUID id);
}

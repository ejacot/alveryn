package com.alveryn.api.organization.repository;

import com.alveryn.api.organization.entity.OrganizationUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;

public interface OrganizationUnitRepository extends JpaRepository<OrganizationUnit, UUID> {
  List<OrganizationUnit> findAllByOrganizationIdOrderByDisplayOrderAscNameAsc(UUID organizationId);
  Optional<OrganizationUnit> findByIdAndOrganizationId(UUID id, UUID organizationId);

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select unit from OrganizationUnit unit where unit.id = :id "
      + "and unit.organization.id = :organizationId")
  Optional<OrganizationUnit> lockByIdAndOrganizationId(@Param("id") UUID id,
      @Param("organizationId") UUID organizationId);
}

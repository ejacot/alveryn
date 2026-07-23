package com.alveryn.api.organization.repository;
import com.alveryn.api.organization.entity.OrganizationActivity;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
public interface OrganizationActivityRepository extends JpaRepository<OrganizationActivity, UUID> {
  List<OrganizationActivity> findAllByOrganizationIdOrderByDisplayOrderAscNameAsc(UUID organizationId);
  Optional<OrganizationActivity> findByIdAndOrganizationId(UUID id, UUID organizationId);
  boolean existsByOrganizationIdAndNormalizedNameAndIdNot(UUID organizationId, String name, UUID id);
  boolean existsByOrganizationIdAndNormalizedName(UUID organizationId, String name);
}

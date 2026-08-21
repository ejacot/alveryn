package com.alveryn.api.staffing.repository;
import com.alveryn.api.staffing.entity.OrganizationWorkType;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
public interface OrganizationWorkTypeRepository extends JpaRepository<OrganizationWorkType, UUID> {
  List<OrganizationWorkType> findAllByOrganizationIdOrderByNameAsc(UUID organizationId);
  List<OrganizationWorkType> findAllByParentId(UUID parentId);
  Optional<OrganizationWorkType> findByIdAndOrganizationId(UUID id, UUID organizationId);
  Optional<OrganizationWorkType> findByOrganizationIdAndCodeIgnoreCase(UUID organizationId,String code);
}

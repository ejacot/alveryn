package com.alveryn.api.staffing.repository;

import com.alveryn.api.staffing.entity.StaffingPlanVersion;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.repository.Repository;

/** Read-only, tenant-scoped access to immutable weekly plan versions. */
public interface StaffingPlanVersionRepository extends Repository<StaffingPlanVersion, UUID> {
  List<StaffingPlanVersion> findAllByOrganizationIdAndUnitIdAndPlanIdOrderByVersionNumberDesc(
      UUID organizationId, UUID unitId, UUID planId);

  Optional<StaffingPlanVersion>
      findByOrganizationIdAndUnitIdAndPlanIdAndVersionNumber(
          UUID organizationId, UUID unitId, UUID planId, int versionNumber);
}

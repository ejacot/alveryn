package com.alveryn.api.staffing.service;

/** Test seam for proving transactional rollback at each immutable snapshot boundary. */
public interface StaffingPlanPublicationFaultProbe {
  enum Stage {
    AFTER_HEADER,
    AFTER_REQUIREMENTS,
    AFTER_ASSIGNMENTS,
    AFTER_REQUIREMENT_COVERAGE,
    AFTER_DAY_COVERAGE,
    AFTER_CHECKSUM,
    AFTER_LATEST_VERSION_POINTER
  }
  void check(Stage stage);
}

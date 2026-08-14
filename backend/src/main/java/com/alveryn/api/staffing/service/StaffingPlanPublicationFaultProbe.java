package com.alveryn.api.staffing.service;

/** Test seam for proving transactional rollback at each immutable snapshot boundary. */
public interface StaffingPlanPublicationFaultProbe {
  enum Stage { AFTER_HEADER, AFTER_REQUIREMENTS, AFTER_ASSIGNMENTS }
  void check(Stage stage);
}

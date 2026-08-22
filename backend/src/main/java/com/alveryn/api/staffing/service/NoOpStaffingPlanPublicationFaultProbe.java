package com.alveryn.api.staffing.service;

import org.springframework.stereotype.Component;

@Component
class NoOpStaffingPlanPublicationFaultProbe implements StaffingPlanPublicationFaultProbe {
  @Override public void check(Stage stage) { /* production no-op */ }
}

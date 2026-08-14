package com.alveryn.api.staffing.service;

import org.springframework.stereotype.Component;

@Component
class NoOpStaffingPlanBootstrapFaultProbe implements StaffingPlanBootstrapFaultProbe {
  @Override public void afterPlanCreated() {}
}

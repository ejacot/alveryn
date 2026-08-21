package com.alveryn.api.staffing.service;

import org.springframework.stereotype.Component;

@Component
class NoOpStaffingPlanMutationFaultProbe implements StaffingPlanMutationFaultProbe {
  @Override public void afterChildMutation() { /* production no-op */ }
}

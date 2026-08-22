package com.alveryn.api.staffing.service;

/** Test seam for proving that child writes and draft revision share one transaction. */
public interface StaffingPlanMutationFaultProbe {
  void afterChildMutation();
}

package com.alveryn.api.organization.entity;

/** Login lifecycle, deliberately separate from whether the employee is operationally active. */
public enum MembershipAccessState {
  MANAGED,
  INVITED,
  CLAIMED
}

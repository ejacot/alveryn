export type MembershipRole = "OWNER" | "ADMIN" | "MANAGER" | "EMPLOYEE";
export type MembershipStatus = "INVITED" | "ACTIVE" | "SUSPENDED";
export type Organization = {
  id: string; name: string; type: "PERSONAL" | "BUSINESS"; timezone: string;
  role: MembershipRole; membershipStatus: MembershipStatus;
};
export type OrganizationMember = {
  membershipId: string; userId: string; email: string; role: MembershipRole;
  status: MembershipStatus; joinedAt: string;
};
export type OrganizationInvitation = {
  id: string; organizationId: string; organizationName: string; email: string;
  role: MembershipRole; expiresAt: string; acceptedAt: string | null; revokedAt: string | null;
};
export type OrganizationActivity = {
  id: string; name: string; color: string; defaultBreakMinutes: number;
  active: boolean; displayOrder: number;
};
export type BusinessShift = {
  shiftId: string; assignmentId: string; membershipId: string; employeeEmail: string;
  employmentId: string; employmentName: string; activityId: string; activityName: string;
  activityColor: string; startsAt: string; endsAt: string; breakMinutes: number;
  status: "DRAFT" | "PUBLISHED" | "CANCELLED" | "COMPLETED";
  assignmentStatus: "ASSIGNED" | "CANCELLED";
  plannedMinutes: number; workedMinutes: number;
};
export type ShiftChangeRequest = {
  id: string; assignmentId: string; employeeEmail: string;
  type: "TIME_CHANGE" | "DROP" | "ABSENCE" | "SWAP";
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  currentStart: string; currentEnd: string; proposedStart: string | null;
  proposedEnd: string | null; reason: string | null; decidedAt: string | null;
};

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

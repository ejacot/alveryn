export type Organization = {
  id: string;
  name: string;
  type: "PERSONAL" | "BUSINESS";
  timezone: string;
  role: "OWNER" | "ADMIN" | "MANAGER" | "EMPLOYEE";
};

export type OrganizationUnit = {
  id: string;
  parentId: string | null;
  name: string;
  type: "LOCATION" | "DEPARTMENT" | "TEAM" | "OTHER";
  checkInMode: "DISABLED" | "OPTIONAL" | "REQUIRED";
  active: boolean;
  displayOrder: number;
};

export type OrganizationMember = {
  id: string;
  userId: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  status: "INVITED" | "ACTIVE" | "SUSPENDED";
};

export type BusinessCalculationMethod="TIME_BASED"|"UNIT_BASED"|"UNITS_PER_HOUR_BASED"|"FIXED_PRICE_BASED";
export type BusinessWorkType = { id:string;unitId:string|null;parentId:string|null;code:string;name:string;color:string;defaultStartTime:string|null;defaultEndTime:string|null;defaultBreakMinutes:number;calculationMethod:BusinessCalculationMethod;compensationMethod:"HOURLY"|"PER_UNIT";unitLabel:string|null;unitSymbol:string|null;unitsPerHour:number|null;ratePerUnit:number|null;currency:string|null;teamworkEnabled:boolean;extraPayEnabled:boolean;compositeEnabled:boolean;displayOrder:number;active:boolean };
export type StaffingAssignmentResult = { id: string; assignmentId: string; organizationId: string; organizationName: string; memberName: string; date: string; workTypeName: string; workTypeCode: string; unitName: string; actualStartTime: string | null; actualEndTime: string | null; breakMinutes: number; completedQuantity: number | null; calculatedMinutes?:number|null; notes: string | null; approvalStatus: "DRAFT" | "SUBMITTED" | "APPROVED"; submittedAt: string | null; reviewedAt: string | null; checkedInAt: string | null; checkedOutAt: string | null; timeCaptureSource: "MANUAL" | "CHECK_IN" };
export type StaffingAssignment = { id: string; membershipId: string; memberName: string; startTime: string | null; endTime: string | null; hasConflict: boolean; conflictingAssignmentIds: string[]; viewed: boolean; result: StaffingAssignmentResult | null };
export type StaffingRequirement = { id: string; unitId: string; unitName: string; workTypeId: string; code: string; workTypeName: string; color: string; date: string; startTime: string | null; endTime: string | null; requiredWorkers: number; assignedWorkers: number; coverageDifference: number; coverageStatus: "UNDERSTAFFED" | "COVERED" | "OVERSTAFFED"; publicationStatus: "DRAFT" | "PUBLISHED"; checkInMode: "DISABLED" | "OPTIONAL" | "REQUIRED"; assignments: StaffingAssignment[] };
export type StaffingDayEntry = { id: string; membershipId: string; date: string; type: "REST_DAY" | "VACATION" | "SICK"; notes: string | null; hasWorkConflict: boolean };
export type PersonalBusinessSchedule = { organizationId: string; organizationName: string; from: string; to: string; currentMembershipId: string; newPublication: boolean; requirements: StaffingRequirement[]; dayEntries: StaffingDayEntry[] };
export type StaffingChangeEvent = { id: string; eventType: string; entityType: string; entityId: string | null; workDate: string | null; summary: string; actorName: string; createdAt: string };
export type BusinessAbsenceRequest = { id:string;organizationId:string;organizationName:string;membershipId:string;memberName:string;type:"REST_DAY"|"VACATION"|"SICK";startDate:string;endDate:string;notes:string|null;status:"PENDING"|"APPROVED"|"REJECTED";createdAt:string;reviewedAt:string|null };
export type OrganizationPermission = "VIEW_SCHEDULE"|"MANAGE_SCHEDULE"|"PUBLISH_SCHEDULE"|"VIEW_TEAM_HOURS"|"APPROVE_ACTUALS"|"MANAGE_ABSENCES"|"MANAGE_MEMBERS"|"MANAGE_TEAMS"|"MANAGE_ROLES"|"MANAGE_SETTINGS";
export type OrganizationRole = {id:string;name:string;permissions:OrganizationPermission[];systemRole:boolean};
export type OrganizationRoleAssignment = {id:string;membershipId:string;roleId:string;unitId:string|null;includeDescendants:boolean};

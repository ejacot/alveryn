export type StaffingPlanCapabilities = {
  view: boolean;
  manage: boolean;
  publish: boolean;
};

export type StaffingCoverageTotals = {
  required: number;
  rawAssigned: number;
  effectiveAssigned: number;
  covered: number;
  missing: number;
  overstaffed: number;
  percentage: number;
  openPositions: number;
};

export type StaffingPublishedVersionSummary = {
  versionId: string;
  versionNumber: number;
  sourceDraftRevision: number;
  publishedAt: string;
  publicationKind: string;
  coverageBasis: string;
  checksum: string;
};

export type StaffingPlanHeader = {
  planId: string;
  organizationId: string;
  unitId: string;
  unitName: string;
  weekStart: string;
  weekEnd: string;
  timezone: string;
  status: "ACTIVE" | "ARCHIVED";
  draftRevision: number;
  etag: string;
  latestPublishedVersion: StaffingPublishedVersionSummary | null;
  publishedRevision: number | null;
  publishedAt: string | null;
  hasUnpublishedChanges: boolean;
  capabilities: StaffingPlanCapabilities;
};

export type StaffingPlanLookup = {
  found: boolean;
  plan: StaffingPlanHeader | null;
};

export type StaffingDemandRequirement = {
  requirementId: string;
  planDayId: string;
  workTypeId: string;
  workTypeCode: string;
  workTypeName: string;
  startTime: string | null;
  endTime: string | null;
  breakMinutes: number;
  requiredWorkers: number;
  requiredQuantity: number | null;
  legacyPublicationStatus: "DRAFT" | "PUBLISHED";
  notes: string | null;
  coverage: StaffingCoverageTotals;
  issueKeys: string[];
};

export type StaffingDemandDay = {
  planDayId: string | null;
  date: string;
  persisted: boolean;
  roomsContext: number | null;
  notes: string | null;
  source: "MANUAL" | "TEMPLATE" | "IMPORT" | "LEGACY_BACKFILL" | null;
  coverage: StaffingCoverageTotals;
  requirements: StaffingDemandRequirement[];
  issueKeys: string[];
};

export type StaffingDemand = {
  planId: string;
  organizationId: string;
  unitId: string;
  weekStart: string;
  weekEnd: string;
  draftRevision: number;
  etag: string;
  coverage: StaffingCoverageTotals;
  days: StaffingDemandDay[];
};

export type StaffingRequirementInput = {
  date: string;
  workTypeId: string;
  startTime: string | null;
  endTime: string | null;
  requiredWorkers: number;
  requiredQuantity: number | null;
  notes: string | null;
};

export type StaffingRequirementUpdateInput = Omit<
  StaffingRequirementInput,
  "date" | "workTypeId"
>;

export type StaffingDemandBatchAction =
  | {
      operation: "CREATE";
      requirementId: null;
      create: StaffingRequirementInput;
      update: null;
    }
  | {
      operation: "UPDATE";
      requirementId: string;
      create: null;
      update: StaffingRequirementUpdateInput;
    }
  | {
      operation: "DELETE";
      requirementId: string;
      create: null;
      update: null;
    };

export type StaffingMutationResult = {
  planId: string;
  previousDraftRevision: number;
  currentDraftRevision: number;
  changed: boolean;
  affectedResourceIds: string[];
};

export type StaffingPlanBootstrapResult = {
  planId: string;
  organizationId: string;
  unitId: string;
  weekStart: string;
  timezone: string;
  status: "ACTIVE" | "ARCHIVED";
  draftRevision: number;
  created: boolean;
  idempotentReplay: boolean;
  capabilities: StaffingPlanCapabilities;
};

export type ApiEntityResult<T> = {
  data: T;
  etag: string | null;
  status: number;
  idempotentReplay: boolean;
};

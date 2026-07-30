export type DataImportScope = "SINGLE" | "MULTIPLE";

export type DataImportSheet = {
  name: string;
  rows: number;
  nonEmptyCells: number;
  formulas: number;
};

export type DataImportCandidate = {
  sourceLabel: string;
  normalizedLabel: string;
  occurrences: number;
  suggestedCalculationType:
    | "UNKNOWN"
    | "TIME_BASED"
    | "UNIT_BASED"
    | "UNITS_PER_HOUR_BASED"
    | "FIXED_AMOUNT";
  suggestedAction:
    | "MATCH_EXISTING"
    | "CREATE_NEW"
    | "CONFIGURE_SURCHARGE"
    | "REVIEW_PER_ENTRY"
    | "MARK_REST_DAY"
    | "IMPORT_AS_ABSENCE";
  suggestedCompensationMethod: "HOURLY" | "PER_UNIT";
  matchedWorkTypeId?: string;
  matchedWorkTypeName?: string;
  reason: string;
  suggestedUnitsPerHour?: number;
  suggestedRatePerUnit?: number;
  suggestedTeamworkEnabled?: boolean;
  suggestedHourlyRate?: number;
  semanticRole?: "ACTIVITY_TIME" | "ACTIVITY_UNIT" | "SURCHARGE" | "REST_DAY" | "ABSENCE" | "IGNORE" | "UNKNOWN";
  markerCandidate?: boolean;
  aiConfidence?: number;
  aiReason?: string;
  aiQuestion?: string;
  extraPayPercentage?: number;
  payrollConfidence?: number;
  payrollReason?: string;
  payrollPeriod?: string;
  confidence: number;
  samples: string[];
};

export type DataImportQuestion = {
  code: string;
  sourceLabel: string;
  prompt: string;
  options: string[];
};

export type DataImportAnalysis = {
  datesAreExplicit?: boolean;
  analyzerVersion?: number;
  sheetCount: number;
  rowCount: number;
  cellCount: number;
  requiresReview: boolean;
  sheets: DataImportSheet[];
  workTypeCandidates: DataImportCandidate[];
  questions: DataImportQuestion[];
  metadataColumns?: {
    sheet: string;
    sourceLabel: string;
    column: number;
    semanticRole: "TEAM_SIZE";
    reason: string;
    confidence: number;
  }[];
  ai?: {
    status: "DISABLED" | "NOT_NEEDED" | "COMPLETED" | "FALLBACK";
    model?: string;
    reviewRequired?: boolean;
  };
  payrollEvidence?: {
    status: "NOT_PROVIDED" | "DISABLED" | "FALLBACK" | "REVIEW_NEEDED" | "COMPLETED";
    usedVision?: boolean;
    pageCount?: number;
    documents?: {
      filename: string;
      pages: number;
      source: "DIGITAL_TEXT" | "VISION";
      status: string;
    }[];
    findings?: {
      sourceLabel: string;
      semanticRole: string;
      percentage?: number | null;
      hourlyRate?: number | null;
      ratePerUnit?: number | null;
      period?: string | null;
      confidence: number;
      reason: string;
    }[];
  };
  periodContext?: {
    year: number;
    month: number;
    source: string;
  };
  sheetPeriodContexts?: {
    sheet: string;
    year: number;
    month: number;
    source: string;
  }[];
};

export type DataImportAnalysisResponse = {
  batchId: string;
  filename: string;
  sha256: string;
  size: number;
  status: string;
  importScope: DataImportScope;
  employmentId: string | null;
  duplicate: boolean;
  analysis: DataImportAnalysis;
};

export type DataImportCandidateDecision = {
  sourceLabel: string;
  action: "CREATE_NEW" | "MATCH_EXISTING" | "CONFIGURE_SURCHARGE" | "REVIEW_PER_ENTRY" | "MARK_REST_DAY" | "IMPORT_AS_ABSENCE" | "IGNORE";
  name?: string;
  workTypeId?: string;
  calculationMethod?: "TIME_BASED" | "UNIT_BASED" | "UNITS_PER_HOUR_BASED" | "FIXED_PRICE_BASED";
  compensationMethod?: "HOURLY" | "PER_UNIT";
  unitsPerHour?: number;
  ratePerUnit?: number;
  currency?: string;
  teamworkEnabled?: boolean;
  extraPayPercentage?: number;
  absenceType?: "DAY_OFF" | "VACATION" | "SICK_LEAVE" | "PUBLIC_HOLIDAY";
  absencePaid?: boolean;
  absencePaidMinutesPerDay?: number;
};

export type DataImportConfirmResponse = {
  batchId: string;
  status: string;
  createdWorkTypes: number;
  mappedWorkTypes: number;
  ignoredColumns: number;
  mappings: {
    sourceLabel: string;
    semanticRole: "ACTIVITY" | "SURCHARGE";
    workTypeId?: string | null;
    workTypeName?: string | null;
    extraPayPercentage?: number | null;
  }[];
};

export type DataImportPreviewEntry = {
  id: string;
  date: string;
  status: "READY" | "NEEDS_INPUT" | "DUPLICATE";
  classification: "WORK" | "REST_DAY" | "ABSENCE";
  absenceType?: "DAY_OFF" | "VACATION" | "SICK_LEAVE" | "PUBLIC_HOLIDAY" | null;
  absencePaid?: boolean | null;
  absencePaidMinutesPerDay?: number | null;
  teamSize?: number | null;
  sheet: string;
  sourceRow: number;
  notes?: string | null;
  lines: {
    workTypeId: string;
    workTypeName: string;
    calculationMethod: string;
    value: number;
    durationMinutes?: number | null;
  }[];
  questions: {
    id: string;
    type: "SURCHARGE" | "NOTE" | "INTERVAL_OR_NOTE";
    sourceLabel?: string | null;
    value: string;
    prompt: string;
    options: string[];
  }[];
};

export type DataImportPreviewResponse = {
  batchId: string;
  readyCount: number;
  questionCount: number;
  duplicateCount: number;
  entries: DataImportPreviewEntry[];
};

export type DataImportExecuteResponse = {
  batchId: string;
  importedRecords: number;
  importedLines: number;
  skippedEntryIds: string[];
};

export type DataImportQuestionResolution = {
  action:
    | "ENTER_PERCENTAGE"
    | "USE_EMPLOYMENT_RULE"
    | "ADD_AS_NOTE"
    | "USE_AS_INTERVAL"
    | "IGNORE";
  percentage?: number;
  targetWorkTypeId?: string;
  eligibleHours?: number;
};

export type DataImportChatMessage = {
  role: "USER" | "ASSISTANT";
  content: string;
};

export type DataImportChatResponse = {
  status: "NEEDS_CLARIFICATION" | "PROPOSAL" | "UNAVAILABLE";
  message: string;
  proposal?: {
    action: DataImportQuestionResolution["action"];
    percentage?: number | null;
    targetWorkTypeId?: string | null;
    eligibleHours?: number | null;
    confirmation?: string | null;
  } | null;
};

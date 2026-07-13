type WorkEntriesParams = {
  year?: number;
  month?: number;
  workTypeId?: string;
  page?: number;
  size?: number;
};

type WorkEntriesRangeParams = Omit<WorkEntriesParams, "page" | "size">;

type AbsencesParams = {
  year?: number;
  month?: number;
  from?: string;
  to?: string;
  absenceType?: string;
  page?: number;
  size?: number;
};

type AbsencesRangeParams = Omit<AbsencesParams, "page" | "size">;

export const queryKeys = {
  currentUser: () => ["current-user"] as const,
  profile: () => ["profile"] as const,
  preferences: () => ["preferences"] as const,
  onboardingStatus: () => ["onboarding-status"] as const,
  dashboard: () => ["dashboard"] as const,
  hourlyRates: {
    all: () => ["hourly-rates"] as const,
    detail: (id: string) => ["hourly-rates", "detail", id] as const
  },
  workTypes: {
    all: () => ["work-types"] as const,
    detail: (id: string) => ["work-types", "detail", id] as const
  },
  unitTypes: {
    all: () => ["unit-types"] as const,
    list: (workTypeId: string) => ["unit-types", "list", workTypeId] as const,
    detail: (workTypeId: string, unitTypeId: string) =>
      ["unit-types", "detail", workTypeId, unitTypeId] as const
  },
  workEntries: {
    all: () => ["work-entries"] as const,
    list: (params: WorkEntriesParams) => ["work-entries", "list", params] as const,
    range: (params: WorkEntriesRangeParams) => ["work-entries", "range", params] as const,
    detail: (id: string) => ["work-entries", "detail", id] as const
  },
  absences: {
    all: () => ["absences"] as const,
    list: (params: AbsencesParams) => ["absences", "list", params] as const,
    range: (params: AbsencesRangeParams) => ["absences", "range", params] as const
  },
  imports: {
    all: () => ["imports"] as const,
    history: () => ["imports", "history"] as const,
    detail: (batchId: string) => ["imports", "detail", batchId] as const
  }
} as const;

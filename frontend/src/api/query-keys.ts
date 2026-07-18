type AbsencesParams = {
  year?: number;
  month?: number;
  from?: string;
  to?: string;
  absenceTypeId?: string;
  absenceType?: string;
  page?: number;
  size?: number;
};

type AbsencesRangeParams = Omit<AbsencesParams, "page" | "size">;

type StatisticsQueryFilters = {
  from: string;
  to: string;
  metric: string;
  heatmapMetric?: string;
  heatmapCurrency?: string | null;
  workTypeIds: readonly string[];
  calculationMethods: readonly string[];
};

type StatisticsComparisonKey = {
  periodA: { from: string; to: string };
  periodB: { from: string; to: string };
  metric: string;
  workTypeIds: readonly string[];
  calculationMethods: readonly string[];
};

export const queryKeys = {
  currentUser: () => ["current-user"] as const,
  profile: () => ["profile"] as const,
  preferences: () => ["preferences"] as const,
  addresses: {
    all: () => ["addresses"] as const
  },
  onboardingStatus: () => ["onboarding-status"] as const,
  dashboard: () => ["dashboard"] as const,
  calendar: {
    activityRange: () => ["calendar", "activity-range"] as const
  },
  hourlyRates: {
    all: () => ["hourly-rates"] as const,
    detail: (id: string) => ["hourly-rates", "detail", id] as const
  },
  workTypes: {
    all: () => ["work-types"] as const,
    detail: (id: string) => ["work-types", "detail", id] as const
  },
  workRecords: {
    all: () => ["work-records"] as const,
    day: (date: string) => ["work-records", "day", date] as const,
    range: (params: { from: string; to: string }) => ["work-records", "range", params] as const,
    detail: (id: string) => ["work-records", "detail", id] as const
  },
  absences: {
    all: () => ["absences"] as const,
    list: (params: AbsencesParams) => ["absences", "list", params] as const,
    range: (params: AbsencesRangeParams) => ["absences", "range", params] as const
  },
  absenceTypes: {
    all: () => ["absence-types"] as const,
    list: (activeOnly: boolean) => ["absence-types", "list", activeOnly] as const
  },
  statistics: {
    all: () => ["statistics"] as const,
    overview: (filters: StatisticsQueryFilters) => ["statistics", "overview", filters] as const,
    timeseries: (filters: StatisticsQueryFilters) => ["statistics", "timeseries", filters] as const,
    workTypes: (filters: StatisticsQueryFilters) => ["statistics", "work-types", filters] as const,
    comparison: (request: StatisticsComparisonKey) => ["statistics", "comparison", request] as const,
    heatmap: (filters: StatisticsQueryFilters) => ["statistics", "heatmap", filters] as const,
    forecast: (filters: StatisticsQueryFilters) => ["statistics", "forecast", filters] as const,
    productivity: (filters: StatisticsQueryFilters) => ["statistics", "productivity", filters] as const,
    highlights: (filters: StatisticsQueryFilters) => ["statistics", "highlights", filters] as const,
    insights: (filters: StatisticsQueryFilters) => ["statistics", "insights", filters] as const,
    drilldown: (filters: Omit<StatisticsQueryFilters, "metric">) =>
      ["statistics", "drilldown", filters] as const
  }
} as const;

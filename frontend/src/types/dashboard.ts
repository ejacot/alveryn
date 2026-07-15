export type SummaryMetric = {
  label: string;
  value: string;
  hint: string;
};

export type DashboardSummaryMetrics = {
  primaryMetric?: SummaryMetric | null;
  secondaryMetrics?: SummaryMetric[];
  tertiaryMetric?: SummaryMetric | null;
};

export type DashboardResponse = {
  currentMonth: string;
  workedHours: string;
  workedMinutes: string;
  grossAmount: string;
  entriesCount: number;
  absenceDays: number;
};

export type RecentEntry = {
  id: string;
  title: string;
  subtitle: string;
  duration: string;
  amount: string;
};

export type SelectedDayActivity = {
  id: string;
  title: string;
  kind: "TIME_BASED" | "UNIT_BASED" | "ABSENCE";
  subtitle: string;
  duration: string;
  amount: string;
  unitBreakdown: Array<{
    id?: string;
    label: string;
    quantity: string;
    displayOrder?: number | null;
  }>;
  marker?: "free" | "sick" | "vacation";
};

export type SelectedDayOverview = {
  label: string;
  entriesCount: number;
  totalDuration: string;
  totalGross: string;
  activities: SelectedDayActivity[];
};

export type WeeklyRhythmDay = {
  key: string;
  label: string;
  value: string;
  markerLabel: string | null;
  status: "under" | "met" | "over" | "idle";
  percentage: number;
  selected: boolean;
};

export type WorkEntrySummary = {
  id: string;
  workTypeId: string;
  workTypeName: string;
  calculationMethod: "TIME_BASED" | "UNIT_BASED";
  workDate: string;
  hourlyRateSnapshot: string;
  currencySnapshot: string;
  calculatedMinutes: string;
  workedHours: string;
  grossAmount: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

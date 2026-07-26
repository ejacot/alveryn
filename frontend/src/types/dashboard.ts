export type SummaryMetric = {
  label: string;
  value: string;
  hint: string;
  placement?: "week" | "financial";
};

export type DashboardSummaryMetrics = {
  primaryMetric?: SummaryMetric | null;
  secondaryMetrics?: SummaryMetric[];
  tertiaryMetric?: SummaryMetric | null;
  extraTimeMetric?: SummaryMetric | null;
  extraMoneyMetric?: SummaryMetric | null;
  totalTimeMetric?: SummaryMetric | null;
  totalMoneyMetric?: SummaryMetric | null;
  absenceMetric?: {
    label: string;
    duration?: string | null;
    amount?: string | null;
  } | null;
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
  kind: "TIME_BASED" | "UNIT_BASED" | "UNITS_PER_HOUR_BASED" | "FIXED_PRICE_BASED" | "ABSENCE";
  subtitle: string;
  projectTitle?: string | null;
  projectNotes?: string | null;
  teamSize?: number | null;
  address?: string | null;
  notes?: string | null;
  periodLabel?: string | null;
  duration: string;
  amount: string;
  extraDuration?: string | null;
  extraAmount?: string | null;
  extraPayLabel?: string | null;
  unitBreakdown: Array<{
    id?: string;
    label: string;
    enteredValue?: string | null;
    interval?: string | null;
    hours?: string | null;
    quantity?: string | null;
    price?: string | null;
    extraPayPercentage?: number | null;
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
  minutes: number;
  amount: number;
  extraMinutes?: number;
  baseAmount?: number;
  extraAmount?: number;
  extraPayPercentages: number[];
  markerLabel: string | null;
  status: "under" | "met" | "over" | "idle" | "absence";
  absence?: {
    type: "free" | "sick" | "vacation";
    label: string;
    color: string;
  } | null;
  percentage: number;
  selected: boolean;
};

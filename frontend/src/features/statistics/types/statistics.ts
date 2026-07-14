import type { CalculationMethod } from "../../../types/work-entry";

export type StatisticsPeriod = "today" | "week" | "month" | "year" | "custom";
export type StatisticsMetric =
  | "GROSS"
  | "WORKED_MINUTES"
  | "WORKED_HOURS"
  | "WORKED_DAYS"
  | "ENTRIES"
  | "AVERAGE_MINUTES_PER_WORKED_DAY";
export type StatisticsGranularity = "DAILY" | "WEEKLY" | "MONTHLY";
export type StatisticsHeatmapMetric = "WORKED_HOURS" | "WORKED_MINUTES" | "ENTRIES" | "GROSS";
export type StatisticsComparisonAlignment =
  | "DAY_OF_WEEK"
  | "DAY_OF_MONTH"
  | "MONTH_OF_YEAR"
  | "RELATIVE_DAY"
  | "RELATIVE_WEEK"
  | "CALENDAR_BUCKET";

export type StatisticsFilters = {
  period: StatisticsPeriod;
  from: string;
  to: string;
  metric: StatisticsMetric;
  workTypeIds: string[];
  calculationMethods: CalculationMethod[];
};

export type MoneyAmount = {
  currency: string;
  amount: string;
};

export type StatisticsComparison = {
  available: boolean;
  percentage: string | null;
  direction: "UP" | "DOWN" | "FLAT" | "NEW" | "NO_DATA";
  grossByCurrency: MoneyAmount[];
};

export type StatisticsOverview = {
  grossByCurrency: MoneyAmount[];
  workedMinutes: string;
  workedDays: number;
  entries: number;
  averageMinutesPerDay: string;
  comparison: StatisticsComparison;
};

export type StatisticsTimeSeriesPoint = {
  bucketStart: string;
  bucketEnd: string;
  value: string;
  metric: StatisticsMetric;
  currency: string | null;
};

export type StatisticsTimeSeries = {
  granularity: StatisticsGranularity;
  metric: StatisticsMetric;
  points: StatisticsTimeSeriesPoint[];
};

export type StatisticsWorkTypeBreakdown = {
  workTypeId: string;
  name: string;
  calculationMethod: CalculationMethod;
  minutes: string;
  grossByCurrency: MoneyAmount[];
  percentage: string;
  percentageBasis: "MINUTES";
  entries: number;
};

export type StatisticsPeriodTotals = {
  from: string;
  to: string;
  workedMinutes: string;
  workedDays: number;
  entries: number;
  grossByCurrency: MoneyAmount[];
  averageMinutesPerWorkedDay: string;
};

export type StatisticsComparisonRequest = {
  periodA: { from: string; to: string };
  periodB: { from: string; to: string };
  metric: StatisticsMetric;
  workTypeIds: string[];
  calculationMethods: CalculationMethod[];
};

export type StatisticsComparisonDifference = {
  currency: string | null;
  periodAValue: string;
  periodBValue: string;
  absolute: string;
  percentage: string | null;
  direction: "UP" | "DOWN" | "FLAT" | "NEW" | "NO_DATA";
  available: boolean;
};

export type StatisticsComparisonSeriesPoint = {
  label: string;
  periodABucketStart: string | null;
  periodABucketEnd: string | null;
  periodBBucketStart: string | null;
  periodBBucketEnd: string | null;
  periodAValue: string;
  periodBValue: string;
  currency: string | null;
};

export type StatisticsAdvancedComparison = {
  metric: StatisticsMetric;
  periodA: StatisticsPeriodTotals;
  periodB: StatisticsPeriodTotals;
  differences: StatisticsComparisonDifference[];
  series: {
    alignment: StatisticsComparisonAlignment;
    granularity: StatisticsGranularity;
    points: StatisticsComparisonSeriesPoint[];
  };
};

export type StatisticsHeatmapDay = {
  date: string;
  value: string;
  workedMinutes: string;
  entries: number;
  grossByCurrency: MoneyAmount[];
  hasAbsence: boolean;
};

export type StatisticsHeatmap = {
  metric: StatisticsHeatmapMetric;
  currency: string | null;
  minimum: string;
  maximum: string;
  days: StatisticsHeatmapDay[];
};

export type StatisticsDrilldown = {
  from: string;
  to: string;
  totals: StatisticsPeriodTotals;
  workTypes: StatisticsWorkTypeBreakdown[];
};

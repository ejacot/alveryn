import type { CalculationMethod } from "../../../types/work-calculation";

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
export type ForecastMode = "CALENDAR_PACE" | "WORKDAY_PACE" | "RECENT_PACE";
export type StatisticsConfidence = "LOW" | "MEDIUM" | "HIGH";
export type ProductivityMetric = "TOTAL_UNITS" | "CONFIGURED_UNITS_PER_HOUR" | "EQUIVALENT_MINUTES";
export type ProductivityGrouping = "TOTAL" | "DAILY" | "WEEKLY" | "MONTHLY" | "WORK_TYPE" | "UNIT_TYPE";
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

export type StatisticsForecastItem = {
  currency: string | null;
  actualGross: string;
  projectedGross: string;
  lowerBound: string;
  upperBound: string;
  workedDays: number;
  elapsedEligibleDays: number;
  remainingEligibleDays: number;
  observedWorkFrequency: string;
  expectedRemainingWorkedDays: string;
  todayIncludedInElapsed: boolean;
  calculationBasis: string;
  sampleSize: number;
  recentWindowStart: string | null;
  recentWindowEnd: string | null;
  recentEligibleDays: number;
  recentWorkedDays: number;
  recentWorkFrequency: string;
  averageGrossPerWorkedDay: string;
  confidence: StatisticsConfidence;
  available: boolean;
  reason: "COMPLETED_PERIOD" | "FUTURE_PERIOD" | "INSUFFICIENT_DATA" | "NO_GROSS_DATA" | null;
};

export type StatisticsForecast = {
  from: string;
  to: string;
  asOf: string;
  mode: ForecastMode;
  forecasts: StatisticsForecastItem[];
};

export type StatisticsProductivityWorkFormula = {
  workFormulaId: string;
  name: string;
  workTypeName: string;
  totalQuantity: string;
  equivalentMinutes: string;
  actualMinutes: string | null;
  configuredUnitsPerHour: string;
  actualUnitsPerHour: string | null;
  performancePercentage: string | null;
  actualProductivityAvailable: boolean;
  entries: number;
  percentageOfTotalUnits: string;
};

export type StatisticsProductivityPoint = {
  bucketStart: string;
  bucketEnd: string;
  value: string;
  metric: ProductivityMetric;
  available: boolean;
};

export type StatisticsProductivity = {
  totalUnits: string;
  equivalentMinutes: string;
  actualMinutes: string | null;
  effectiveConfiguredUnitsPerHour: string;
  actualUnitsPerHour: string | null;
  performancePercentage: string | null;
  actualProductivityAvailable: boolean;
  available: boolean;
  partial: boolean;
  incompleteItems: number;
  workFormulas: StatisticsProductivityWorkFormula[];
  grouping: ProductivityGrouping;
  granularity: StatisticsGranularity;
  metric: ProductivityMetric;
  points: StatisticsProductivityPoint[];
};

export type StatisticsHighlight = {
  type:
    | "BEST_GROSS_DAY"
    | "BEST_HOURS_DAY"
    | "LONGEST_SHIFT"
    | "AVERAGE_SHIFT"
    | "MOST_USED_WORK_TYPE"
    | "BUSIEST_WEEKDAY"
    | "CURRENT_STREAK"
    | "LONGEST_STREAK"
    | "WEEKEND_WORK_COUNT"
    | "OVERNIGHT_SHIFT_COUNT";
  available: boolean;
  label: string | null;
  value: string | null;
  from: string | null;
  to: string | null;
  numericValue: string | null;
  currency: string | null;
  grossByCurrency: MoneyAmount[];
};

export type StatisticsHighlights = {
  highlights: StatisticsHighlight[];
};

export type StatisticsInsight = {
  type:
    | "HOURS_CHANGE"
    | "GROSS_CHANGE"
    | "WORKED_DAYS_CHANGE"
    | "AVERAGE_SHIFT_CHANGE"
    | "BEST_WEEKDAY"
    | "MOST_USED_WORK_TYPE"
    | "STREAK"
    | "FORECAST_ABOVE_PREVIOUS_PERIOD"
    | "FORECAST_BELOW_PREVIOUS_PERIOD";
  direction: "UP" | "DOWN" | "FLAT" | "NEW" | "NO_DATA";
  percentage: string | null;
  currentValue: string | null;
  previousValue: string | null;
  currency: string | null;
  subject: string | null;
  severity: "POSITIVE" | "NEUTRAL" | "ATTENTION";
  confidence: StatisticsConfidence;
};

export type StatisticsInsights = {
  insights: StatisticsInsight[];
};

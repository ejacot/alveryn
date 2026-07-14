import type { CalculationMethod } from "../../../types/work-entry";

export type StatisticsPeriod = "today" | "week" | "month" | "year" | "custom";
export type StatisticsMetric =
  | "GROSS"
  | "WORKED_MINUTES"
  | "WORKED_HOURS"
  | "WORKED_DAYS"
  | "ENTRIES";
export type StatisticsGranularity = "DAILY" | "WEEKLY" | "MONTHLY";

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

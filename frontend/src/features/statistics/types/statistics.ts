import type { CalculationMethod } from "../../../types/work-entry";

export type StatisticsPeriod = "today" | "week" | "month" | "year" | "custom";

export type StatisticsFilters = {
  period: StatisticsPeriod;
  from: string;
  to: string;
  workTypeIds: string[];
  calculationMethods: CalculationMethod[];
  timezone: string;
};

export type StatisticsOverview = {
  grossAmount: string;
  currency: string | null;
  workedMinutes: string;
  workedDays: number;
  entries: number;
  averageMinutesPerDay: string;
  comparisonPercentage: string;
  comparisonDirection: "UP" | "DOWN" | "FLAT";
};

export type StatisticsTimeSeriesPoint = {
  date: string;
  value: string;
};

export type StatisticsWorkTypeBreakdown = {
  workTypeId: string;
  name: string;
  minutes: string;
  gross: string;
  percentage: string;
  entries: number;
};

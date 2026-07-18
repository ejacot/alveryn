import type { CalculationMethod } from "../../../types/work-calculation";
import type { StatisticsFilters, StatisticsMetric, StatisticsPeriod } from "../types/statistics";
import {
  addDays,
  formatLocalDate,
  monthRange,
  previousEqualRange,
  startOfWeekMonday,
  yearRange
} from "./statistics-date-utils";

export const formatStatisticsDate = formatLocalDate;

function rangeForPeriod(period: StatisticsPeriod, now = new Date()) {
  if (period === "today") {
    const today = formatStatisticsDate(now);
    return { from: today, to: today };
  }
  if (period === "week") {
    const from = startOfWeekMonday(now);
    return { from: formatStatisticsDate(from), to: formatStatisticsDate(addDays(from, 6)) };
  }
  if (period === "month") {
    return monthRange(now);
  }
  return yearRange(now);
}

export function createDefaultStatisticsFilters(now = new Date()): StatisticsFilters {
  const range = rangeForPeriod("month", now);
  return {
    period: "month",
    from: range.from,
    to: range.to,
    metric: "GROSS",
    workTypeIds: [],
    calculationMethods: []
  };
}

export function updateStatisticsPeriod(
  filters: StatisticsFilters,
  period: StatisticsPeriod
): StatisticsFilters {
  if (period === "custom") {
    return { ...filters, period };
  }
  return { ...filters, period, ...rangeForPeriod(period) };
}

export function updateStatisticsWorkTypes(
  filters: StatisticsFilters,
  workTypeIds: string[]
): StatisticsFilters {
  return { ...filters, workTypeIds: [...new Set(workTypeIds)].sort() };
}

export function updateStatisticsWorkType(
  filters: StatisticsFilters,
  workTypeId: string
): StatisticsFilters {
  return updateStatisticsWorkTypes(filters, workTypeId ? [workTypeId] : []);
}

export function updateStatisticsCalculationMethod(
  filters: StatisticsFilters,
  calculationMethod: "" | CalculationMethod
): StatisticsFilters {
  return { ...filters, calculationMethods: calculationMethod ? [calculationMethod] : [] };
}

export function updateStatisticsMetric(
  filters: StatisticsFilters,
  metric: StatisticsMetric
): StatisticsFilters {
  return { ...filters, metric };
}

export function updateStatisticsCustomRange(
  filters: StatisticsFilters,
  from: string,
  to: string
): StatisticsFilters {
  return { ...filters, period: "custom", from, to };
}

export function previousRange(filters: StatisticsFilters) {
  return previousEqualRange(filters.from, filters.to);
}

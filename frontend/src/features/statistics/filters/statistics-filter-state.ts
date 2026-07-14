import type { CalculationMethod } from "../../../types/work-entry";
import type { StatisticsFilters, StatisticsMetric, StatisticsPeriod } from "../types/statistics";

const DAY_MS = 86_400_000;

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfWeek(date: Date) {
  const next = new Date(date);
  const day = next.getDay() || 7;
  next.setDate(next.getDate() - day + 1);
  return next;
}

function rangeForPeriod(period: StatisticsPeriod, now = new Date()) {
  if (period === "today") {
    const today = formatDate(now);
    return { from: today, to: today };
  }
  if (period === "week") {
    const from = startOfWeek(now);
    return { from: formatDate(from), to: formatDate(new Date(from.getTime() + DAY_MS * 6)) };
  }
  if (period === "month") {
    return {
      from: formatDate(new Date(now.getFullYear(), now.getMonth(), 1)),
      to: formatDate(new Date(now.getFullYear(), now.getMonth() + 1, 0))
    };
  }
  return {
    from: formatDate(new Date(now.getFullYear(), 0, 1)),
    to: formatDate(new Date(now.getFullYear(), 11, 31))
  };
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

export function updateStatisticsWorkType(
  filters: StatisticsFilters,
  workTypeId: string
): StatisticsFilters {
  return { ...filters, workTypeIds: workTypeId ? [workTypeId] : [] };
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

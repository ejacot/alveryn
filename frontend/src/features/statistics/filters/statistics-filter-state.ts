import type { CalculationMethod } from "../../../types/work-entry";
import type { StatisticsFilters, StatisticsMetric, StatisticsPeriod } from "../types/statistics";

const DAY_MS = 86_400_000;

export function formatStatisticsDate(date: Date) {
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
    const today = formatStatisticsDate(now);
    return { from: today, to: today };
  }
  if (period === "week") {
    const from = startOfWeek(now);
    return { from: formatStatisticsDate(from), to: formatStatisticsDate(new Date(from.getTime() + DAY_MS * 6)) };
  }
  if (period === "month") {
    return {
      from: formatStatisticsDate(new Date(now.getFullYear(), now.getMonth(), 1)),
      to: formatStatisticsDate(new Date(now.getFullYear(), now.getMonth() + 1, 0))
    };
  }
  return {
    from: formatStatisticsDate(new Date(now.getFullYear(), 0, 1)),
    to: formatStatisticsDate(new Date(now.getFullYear(), 11, 31))
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
  const from = new Date(`${filters.from}T00:00:00`);
  const to = new Date(`${filters.to}T00:00:00`);
  const days = Math.round((to.getTime() - from.getTime()) / DAY_MS) + 1;
  const previousTo = new Date(from.getTime() - DAY_MS);
  const previousFrom = new Date(previousTo.getTime() - DAY_MS * (days - 1));
  return {
    from: formatStatisticsDate(previousFrom),
    to: formatStatisticsDate(previousTo)
  };
}

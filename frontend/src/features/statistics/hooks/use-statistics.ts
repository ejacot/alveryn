import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../api/query-keys";
import {
  getStatisticsOverview,
  getStatisticsTimeSeries,
  getStatisticsWorkTypes,
  getStatisticsHeatmap,
  getStatisticsForecast,
  getStatisticsProductivity,
  getStatisticsHighlights,
  getStatisticsInsights,
  getStatisticsComparison
} from "../api/statistics-api";
import type { StatisticsFilters } from "../types/statistics";
import type { StatisticsHeatmapMetric } from "../types/statistics";
import type { ProductivityGrouping, ProductivityMetric } from "../types/statistics";
import { previousRange } from "../filters/statistics-filter-state";

function localDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDate(value: string) {
  return new Date(`${value}T12:00:00`);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function trendComparisonPeriods(filters: StatisticsFilters, now = new Date()) {
  const filterFrom = parseDate(filters.from);
  const filterTo = parseDate(filters.to);
  const today = parseDate(localDate(now));
  const includesToday = filterFrom <= today && today <= filterTo;
  const periodATo = includesToday ? today : filterTo;
  const elapsedDays = Math.round((periodATo.getTime() - filterFrom.getTime()) / 86_400_000);

  if (filters.period === "month") {
    const previousFrom = new Date(filterFrom.getFullYear(), filterFrom.getMonth() - 1, 1, 12);
    const previousMonthEnd = new Date(filterFrom.getFullYear(), filterFrom.getMonth(), 0, 12);
    const previousTo = new Date(Math.min(
      addDays(previousFrom, elapsedDays).getTime(),
      previousMonthEnd.getTime()
    ));
    return {
      periodA: { from: filters.from, to: localDate(periodATo) },
      periodB: { from: localDate(previousFrom), to: localDate(previousTo) }
    };
  }

  if (filters.period === "week") {
    return {
      periodA: { from: filters.from, to: localDate(periodATo) },
      periodB: {
        from: localDate(addDays(filterFrom, -7)),
        to: localDate(addDays(periodATo, -7))
      }
    };
  }

  if (filters.period === "year") {
    const previousFrom = new Date(filterFrom.getFullYear() - 1, filterFrom.getMonth(), filterFrom.getDate(), 12);
    const previousTo = new Date(periodATo.getFullYear() - 1, periodATo.getMonth(), periodATo.getDate(), 12);
    return {
      periodA: { from: filters.from, to: localDate(periodATo) },
      periodB: { from: localDate(previousFrom), to: localDate(previousTo) }
    };
  }

  if (filters.period === "today") {
    const yesterday = localDate(addDays(filterFrom, -1));
    return {
      periodA: { from: filters.from, to: filters.to },
      periodB: { from: yesterday, to: yesterday }
    };
  }

  return {
    periodA: { from: filters.from, to: filters.to },
    periodB: previousRange(filters)
  };
}

function normalizedFilters(filters: StatisticsFilters) {
  return {
    from: filters.from,
    to: filters.to,
    metric: filters.metric,
    workTypeIds: [...filters.workTypeIds].sort(),
    calculationMethods: [...filters.calculationMethods].sort()
  };
}

export function useStatistics(
  filters: StatisticsFilters,
  heatmapMetric: StatisticsHeatmapMetric = "WORKED_HOURS",
  heatmapCurrency: string | null = null,
  productivityMetric: ProductivityMetric = "TOTAL_UNITS",
  productivityGrouping: ProductivityGrouping = "TOTAL"
) {
  const keyFilters = normalizedFilters(filters);
  const heatmapKeyFilters = { ...keyFilters, heatmapMetric, heatmapCurrency };
  const productivityKeyFilters = { ...keyFilters, productivityMetric, productivityGrouping };
  const overview = useQuery({
    queryKey: queryKeys.statistics.overview(keyFilters),
    queryFn: () => getStatisticsOverview(filters)
  });
  const timeSeries = useQuery({
    queryKey: queryKeys.statistics.timeseries(keyFilters),
    queryFn: () => getStatisticsTimeSeries(filters)
  });
  const trendPeriods = trendComparisonPeriods(filters);
  const comparisonRequest = {
    ...trendPeriods,
    metric: filters.metric,
    workTypeIds: filters.workTypeIds,
    calculationMethods: filters.calculationMethods
  };
  const comparison = useQuery({
    queryKey: queryKeys.statistics.comparison({
      ...comparisonRequest,
      workTypeIds: [...comparisonRequest.workTypeIds].sort(),
      calculationMethods: [...comparisonRequest.calculationMethods].sort()
    }),
    queryFn: () => getStatisticsComparison(comparisonRequest),
    placeholderData: (previous) => previous
  });
  const workTypes = useQuery({
    queryKey: queryKeys.statistics.workTypes(keyFilters),
    queryFn: () => getStatisticsWorkTypes(filters)
  });
  const heatmap = useQuery({
    queryKey: queryKeys.statistics.heatmap(heatmapKeyFilters),
    queryFn: () => getStatisticsHeatmap(filters, heatmapMetric, heatmapCurrency),
    retry: false
  });
  const forecast = useQuery({
    queryKey: queryKeys.statistics.forecast(keyFilters),
    queryFn: () => getStatisticsForecast(filters),
    placeholderData: (previous) => previous
  });
  const productivity = useQuery({
    queryKey: queryKeys.statistics.productivity(productivityKeyFilters),
    queryFn: () => getStatisticsProductivity(filters, productivityMetric, productivityGrouping),
    placeholderData: (previous) => previous
  });
  const highlights = useQuery({
    queryKey: queryKeys.statistics.highlights(keyFilters),
    queryFn: () => getStatisticsHighlights(filters),
    placeholderData: (previous) => previous
  });
  const insights = useQuery({
    queryKey: queryKeys.statistics.insights(keyFilters),
    queryFn: () => getStatisticsInsights(filters),
    placeholderData: (previous) => previous
  });

  return {
    overview,
    timeSeries,
    comparison,
    workTypes,
    heatmap,
    forecast,
    productivity,
    highlights,
    insights,
    isLoading: overview.isLoading || timeSeries.isLoading || workTypes.isLoading,
    isError: overview.isError || timeSeries.isError || workTypes.isError,
    refetch: () => {
      void overview.refetch();
      void timeSeries.refetch();
      void comparison.refetch();
      void workTypes.refetch();
      void heatmap.refetch();
      void forecast.refetch();
      void productivity.refetch();
      void highlights.refetch();
      void insights.refetch();
    }
  };
}

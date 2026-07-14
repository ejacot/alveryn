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
  getStatisticsInsights
} from "../api/statistics-api";
import type { StatisticsFilters } from "../types/statistics";
import type { StatisticsHeatmapMetric } from "../types/statistics";

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
  heatmapCurrency: string | null = null
) {
  const keyFilters = normalizedFilters(filters);
  const heatmapKeyFilters = { ...keyFilters, heatmapMetric, heatmapCurrency };
  const overview = useQuery({
    queryKey: queryKeys.statistics.overview(keyFilters),
    queryFn: () => getStatisticsOverview(filters)
  });
  const timeSeries = useQuery({
    queryKey: queryKeys.statistics.timeseries(keyFilters),
    queryFn: () => getStatisticsTimeSeries(filters)
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
    queryKey: queryKeys.statistics.productivity(keyFilters),
    queryFn: () => getStatisticsProductivity(filters),
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
      void workTypes.refetch();
      void heatmap.refetch();
      void forecast.refetch();
      void productivity.refetch();
      void highlights.refetch();
      void insights.refetch();
    }
  };
}

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../api/query-keys";
import {
  getStatisticsOverview,
  getStatisticsTimeSeries,
  getStatisticsWorkTypes,
  getStatisticsHeatmap
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

  return {
    overview,
    timeSeries,
    workTypes,
    heatmap,
    isLoading: overview.isLoading || timeSeries.isLoading || workTypes.isLoading,
    isError: overview.isError || timeSeries.isError || workTypes.isError,
    refetch: () => {
      void overview.refetch();
      void timeSeries.refetch();
      void workTypes.refetch();
      void heatmap.refetch();
    }
  };
}

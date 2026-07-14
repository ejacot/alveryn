import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../api/query-keys";
import {
  getStatisticsOverview,
  getStatisticsTimeSeries,
  getStatisticsWorkTypes
} from "../api/statistics-api";
import type { StatisticsFilters } from "../types/statistics";

export function useStatistics(filters: StatisticsFilters) {
  const overview = useQuery({
    queryKey: queryKeys.statistics.overview(filters),
    queryFn: () => getStatisticsOverview(filters)
  });
  const timeSeries = useQuery({
    queryKey: queryKeys.statistics.timeseries(filters),
    queryFn: () => getStatisticsTimeSeries(filters)
  });
  const workTypes = useQuery({
    queryKey: queryKeys.statistics.workTypes(filters),
    queryFn: () => getStatisticsWorkTypes(filters)
  });

  return {
    overview,
    timeSeries,
    workTypes,
    isLoading: overview.isLoading || timeSeries.isLoading || workTypes.isLoading,
    isError: overview.isError || timeSeries.isError || workTypes.isError,
    refetch: () => {
      void overview.refetch();
      void timeSeries.refetch();
      void workTypes.refetch();
    }
  };
}

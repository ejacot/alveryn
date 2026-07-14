import type { ApiResponse } from "../../../types/api";
import { http } from "../../../api/http";
import type {
  StatisticsFilters,
  StatisticsOverview,
  StatisticsTimeSeriesPoint,
  StatisticsWorkTypeBreakdown
} from "../types/statistics";

function paramsFromFilters(filters: StatisticsFilters) {
  const params = new URLSearchParams({
    from: filters.from,
    to: filters.to,
    timezone: filters.timezone
  });
  for (const workTypeId of filters.workTypeIds) {
    params.append("workTypeIds", workTypeId);
  }
  for (const calculationMethod of filters.calculationMethods) {
    params.append("calculationMethods", calculationMethod);
  }
  return params;
}

export async function getStatisticsOverview(filters: StatisticsFilters) {
  const response = await http.get<ApiResponse<StatisticsOverview>>(
    "/api/statistics/overview",
    { params: paramsFromFilters(filters) }
  );
  return response.data.data;
}

export async function getStatisticsTimeSeries(filters: StatisticsFilters) {
  const response = await http.get<ApiResponse<StatisticsTimeSeriesPoint[]>>(
    "/api/statistics/timeseries",
    { params: paramsFromFilters(filters) }
  );
  return response.data.data;
}

export async function getStatisticsWorkTypes(filters: StatisticsFilters) {
  const response = await http.get<ApiResponse<StatisticsWorkTypeBreakdown[]>>(
    "/api/statistics/work-types",
    { params: paramsFromFilters(filters) }
  );
  return response.data.data;
}

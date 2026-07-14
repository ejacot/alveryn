import type { ApiResponse } from "../../../types/api";
import { http } from "../../../api/http";
import type {
  StatisticsFilters,
  StatisticsAdvancedComparison,
  StatisticsComparisonRequest,
  StatisticsDrilldown,
  StatisticsHeatmap,
  StatisticsHeatmapMetric,
  StatisticsForecast,
  StatisticsOverview,
  StatisticsProductivity,
  ProductivityGrouping,
  ProductivityMetric,
  StatisticsHighlights,
  StatisticsInsights,
  StatisticsTimeSeries,
  StatisticsWorkTypeBreakdown
} from "../types/statistics";

function paramsFromFilters(filters: StatisticsFilters) {
  const params = new URLSearchParams({
    from: filters.from,
    to: filters.to
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
  const params = paramsFromFilters(filters);
  params.set("metric", filters.metric);
  const response = await http.get<ApiResponse<StatisticsTimeSeries>>(
    "/api/statistics/timeseries",
    { params }
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

export async function getStatisticsComparison(request: StatisticsComparisonRequest) {
  const response = await http.post<ApiResponse<StatisticsAdvancedComparison>>(
    "/api/statistics/comparison",
    request
  );
  return response.data.data;
}

export async function getStatisticsHeatmap(
  filters: StatisticsFilters,
  metric: StatisticsHeatmapMetric,
  currency?: string | null
) {
  const params = paramsFromFilters(filters);
  params.set("metric", metric);
  if (currency) {
    params.set("currency", currency);
  }
  const response = await http.get<ApiResponse<StatisticsHeatmap>>("/api/statistics/heatmap", {
    params
  });
  return response.data.data;
}

export async function getStatisticsDrilldown(filters: StatisticsFilters) {
  const response = await http.get<ApiResponse<StatisticsDrilldown>>(
    "/api/statistics/drilldown",
    { params: paramsFromFilters(filters) }
  );
  return response.data.data;
}

export async function getStatisticsForecast(filters: StatisticsFilters) {
  const response = await http.get<ApiResponse<StatisticsForecast>>(
    "/api/statistics/forecast",
    { params: paramsFromFilters(filters) }
  );
  return response.data.data;
}

export async function getStatisticsProductivity(
  filters: StatisticsFilters,
  metric: ProductivityMetric = "TOTAL_UNITS",
  grouping: ProductivityGrouping = "TOTAL"
) {
  const params = paramsFromFilters(filters);
  params.set("metric", metric);
  params.set("grouping", grouping);
  const response = await http.get<ApiResponse<StatisticsProductivity>>(
    "/api/statistics/productivity",
    { params }
  );
  return response.data.data;
}

export async function getStatisticsHighlights(filters: StatisticsFilters) {
  const response = await http.get<ApiResponse<StatisticsHighlights>>(
    "/api/statistics/highlights",
    { params: paramsFromFilters(filters) }
  );
  return response.data.data;
}

export async function getStatisticsInsights(filters: StatisticsFilters) {
  const response = await http.get<ApiResponse<StatisticsInsights>>(
    "/api/statistics/insights",
    { params: paramsFromFilters(filters) }
  );
  return response.data.data;
}

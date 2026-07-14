import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { listWorkTypes } from "../../../api/endpoints";
import { queryKeys } from "../../../api/query-keys";
import { SectionHeading } from "../../../components/ui/section-heading";
import { StatisticsLineChart } from "../charts/statistics-line-chart";
import { StatisticsComparisonPanel } from "../components/statistics-comparison-panel";
import { StatisticsDrilldownPanel } from "../components/statistics-drilldown-panel";
import { StatisticsFilterBar } from "../components/statistics-filter-bar";
import { StatisticsHeatmap } from "../components/statistics-heatmap";
import { StatisticsPrimarySummary, StatisticsSummaryCards } from "../components/statistics-summary";
import {
  StatisticsEmptyState,
  StatisticsErrorState,
  StatisticsSkeleton
} from "../components/statistics-states";
import { WorkTypeBreakdown } from "../components/work-type-breakdown";
import { createDefaultStatisticsFilters, updateStatisticsCustomRange } from "../filters/statistics-filter-state";
import { useStatistics } from "../hooks/use-statistics";
import type {
  StatisticsFilters,
  StatisticsHeatmapMetric,
  StatisticsMetric,
  StatisticsPeriod,
  StatisticsTimeSeriesPoint
} from "../types/statistics";

function parseFilters(searchParams: URLSearchParams): StatisticsFilters {
  const defaults = createDefaultStatisticsFilters();
  const period = searchParams.get("period") as StatisticsPeriod | null;
  const metric = searchParams.get("metric") as StatisticsMetric | null;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const parsed: StatisticsFilters = {
    ...defaults,
    period: period && ["today", "week", "month", "year", "custom"].includes(period) ? period : defaults.period,
    metric:
      metric && ["GROSS", "WORKED_MINUTES", "WORKED_HOURS", "WORKED_DAYS", "ENTRIES"].includes(metric)
        ? metric
        : defaults.metric,
    workTypeIds: searchParams.getAll("workTypeIds").filter(Boolean).sort(),
    calculationMethods: searchParams
      .getAll("calculationMethods")
      .filter((value): value is "TIME_BASED" | "UNIT_BASED" => value === "TIME_BASED" || value === "UNIT_BASED")
      .sort()
  };
  if (from && to && to >= from) {
    return updateStatisticsCustomRange(parsed, from, to);
  }
  return parsed;
}

function parseHeatmapMetric(searchParams: URLSearchParams): StatisticsHeatmapMetric {
  const value = searchParams.get("heatmapMetric");
  return value && ["WORKED_HOURS", "WORKED_MINUTES", "ENTRIES", "GROSS"].includes(value)
    ? (value as StatisticsHeatmapMetric)
    : "WORKED_HOURS";
}

function writeFilters(
  filters: StatisticsFilters,
  heatmapMetric: StatisticsHeatmapMetric,
  heatmapCurrency: string | null,
  currentParams: URLSearchParams
) {
  const params = new URLSearchParams(currentParams);
  params.set("period", filters.period);
  params.set("from", filters.from);
  params.set("to", filters.to);
  params.set("metric", filters.metric);
  params.set("heatmapMetric", heatmapMetric);
  params.delete("heatmapCurrency");
  params.delete("workTypeIds");
  params.delete("calculationMethods");
  if (heatmapCurrency) {
    params.set("heatmapCurrency", heatmapCurrency);
  }
  for (const workTypeId of filters.workTypeIds) {
    params.append("workTypeIds", workTypeId);
  }
  for (const method of filters.calculationMethods) {
    params.append("calculationMethods", method);
  }
  return params;
}

export function StatisticsPage() {
  const { t } = useTranslation("common");
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFiltersState] = useState(() => parseFilters(searchParams));
  const [heatmapMetric, setHeatmapMetricState] = useState(() => parseHeatmapMetric(searchParams));
  const [heatmapCurrency, setHeatmapCurrencyState] = useState(() => searchParams.get("heatmapCurrency"));
  const [selectedHeatmapDay, setSelectedHeatmapDay] = useState<string | null>(null);
  const [selectedChartPoint, setSelectedChartPoint] = useState<StatisticsTimeSeriesPoint | null>(null);
  const workTypes = useQuery({
    queryKey: queryKeys.workTypes.all(),
    queryFn: listWorkTypes
  });
  const statistics = useStatistics(filters, heatmapMetric, heatmapCurrency);

  useEffect(() => {
    setFiltersState(parseFilters(searchParams));
    setHeatmapMetricState(parseHeatmapMetric(searchParams));
    setHeatmapCurrencyState(searchParams.get("heatmapCurrency"));
  }, [searchParams]);

  function setFilters(next: StatisticsFilters) {
    setFiltersState(next);
    setSearchParams(writeFilters(next, heatmapMetric, heatmapCurrency, searchParams), { replace: false });
    setSelectedChartPoint(null);
  }

  function setHeatmapOptions(metric: StatisticsHeatmapMetric, currency: string | null) {
    setHeatmapMetricState(metric);
    setHeatmapCurrencyState(currency);
    setSearchParams(writeFilters(filters, metric, currency, searchParams), { replace: false });
  }

  if (statistics.isLoading) {
    return <StatisticsSkeleton />;
  }

  const overview = statistics.overview.data;
  const timeSeries = statistics.timeSeries.data;
  const breakdown = statistics.workTypes.data ?? [];
  const hasEntries = Boolean(overview && overview.entries > 0);

  return (
    <div className="space-y-5 pb-6">
      <SectionHeading eyebrow={t("statistics.eyebrow")} title={t("statistics.title")} />
      <StatisticsFilterBar filters={filters} workTypes={workTypes.data ?? []} onChange={setFilters} />
      {statistics.isError || !overview ? (
        <StatisticsErrorState onRetry={statistics.refetch} />
      ) : !hasEntries ? (
        <StatisticsEmptyState />
      ) : (
        <>
          <StatisticsPrimarySummary overview={overview} />
          <StatisticsLineChart
            points={timeSeries?.points ?? []}
            metric={timeSeries?.metric ?? filters.metric}
            granularity={timeSeries?.granularity ?? "DAILY"}
            onPointSelect={setSelectedChartPoint}
          />
          <StatisticsDrilldownPanel filters={filters} point={selectedChartPoint} onClose={() => setSelectedChartPoint(null)} />
          <StatisticsSummaryCards overview={overview} />
          <StatisticsComparisonPanel filters={filters} />
          <WorkTypeBreakdown items={breakdown} />
          <StatisticsHeatmap
            heatmap={statistics.heatmap.data}
            isLoading={statistics.heatmap.isLoading}
            isError={statistics.heatmap.isError}
            onRetry={() => void statistics.heatmap.refetch()}
            metric={heatmapMetric}
            currency={heatmapCurrency}
            availableCurrencies={overview.grossByCurrency.map((amount) => amount.currency)}
            onOptionsChange={setHeatmapOptions}
            selectedDay={selectedHeatmapDay}
            onSelectDay={setSelectedHeatmapDay}
          />
        </>
      )}
    </div>
  );
}

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
  StatisticsForecastSection,
  StatisticsHighlightsSection,
  StatisticsInsightsSection,
  StatisticsProductivitySection
} from "../components/statistics-v2b-sections";
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
  ProductivityGrouping,
  ProductivityMetric,
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
      .filter(
        (value): value is "TIME_BASED" | "UNIT_BASED" | "UNITS_PER_HOUR_BASED" | "FIXED_PRICE_BASED" =>
          value === "TIME_BASED"
          || value === "UNIT_BASED"
          || value === "UNITS_PER_HOUR_BASED"
          || value === "FIXED_PRICE_BASED"
      )
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

function parseProductivityMetric(searchParams: URLSearchParams): ProductivityMetric {
  const value = searchParams.get("productivityMetric");
  return value && ["TOTAL_UNITS", "CONFIGURED_UNITS_PER_HOUR", "EQUIVALENT_MINUTES"].includes(value)
    ? (value as ProductivityMetric)
    : "TOTAL_UNITS";
}

function parseProductivityGrouping(searchParams: URLSearchParams): ProductivityGrouping {
  const value = searchParams.get("productivityGrouping");
  return value && ["TOTAL", "DAILY", "WEEKLY", "MONTHLY"].includes(value)
    ? (value as ProductivityGrouping)
    : "TOTAL";
}

function writeFilters(
  filters: StatisticsFilters,
  heatmapMetric: StatisticsHeatmapMetric,
  heatmapCurrency: string | null,
  productivityMetric: ProductivityMetric,
  productivityGrouping: ProductivityGrouping,
  currentParams: URLSearchParams
) {
  const params = new URLSearchParams(currentParams);
  params.set("period", filters.period);
  params.set("from", filters.from);
  params.set("to", filters.to);
  params.set("metric", filters.metric);
  params.set("heatmapMetric", heatmapMetric);
  params.set("productivityMetric", productivityMetric);
  params.set("productivityGrouping", productivityGrouping);
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

function latestSearchParams(fallback: URLSearchParams) {
  return typeof window === "undefined" ? fallback : new URLSearchParams(window.location.search);
}

export function StatisticsPage() {
  const { t } = useTranslation("common");
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFiltersState] = useState(() => parseFilters(searchParams));
  const [heatmapMetric, setHeatmapMetricState] = useState(() => parseHeatmapMetric(searchParams));
  const [heatmapCurrency, setHeatmapCurrencyState] = useState(() => searchParams.get("heatmapCurrency"));
  const [productivityMetric, setProductivityMetricState] = useState(() => parseProductivityMetric(searchParams));
  const [productivityGrouping, setProductivityGroupingState] = useState(() => parseProductivityGrouping(searchParams));
  const [selectedHeatmapDay, setSelectedHeatmapDay] = useState<string | null>(null);
  const [selectedChartPoint, setSelectedChartPoint] = useState<StatisticsTimeSeriesPoint | null>(null);
  const workTypes = useQuery({
    queryKey: queryKeys.workTypes.all(),
    queryFn: listWorkTypes
  });
  const statistics = useStatistics(filters, heatmapMetric, heatmapCurrency, productivityMetric, productivityGrouping);

  useEffect(() => {
    setFiltersState(parseFilters(searchParams));
    setHeatmapMetricState(parseHeatmapMetric(searchParams));
    setHeatmapCurrencyState(searchParams.get("heatmapCurrency"));
    setProductivityMetricState(parseProductivityMetric(searchParams));
    setProductivityGroupingState(parseProductivityGrouping(searchParams));
  }, [searchParams]);

  function setFilters(next: StatisticsFilters) {
    setFiltersState(next);
    setSearchParams(
      writeFilters(
        next,
        heatmapMetric,
        heatmapCurrency,
        productivityMetric,
        productivityGrouping,
        latestSearchParams(searchParams)
      ),
      { replace: false }
    );
    setSelectedChartPoint(null);
  }

  function setHeatmapOptions(metric: StatisticsHeatmapMetric, currency: string | null) {
    setHeatmapMetricState(metric);
    setHeatmapCurrencyState(currency);
    setSearchParams(
      writeFilters(filters, metric, currency, productivityMetric, productivityGrouping, latestSearchParams(searchParams)),
      { replace: false }
    );
  }

  function setProductivityOptions(metric: ProductivityMetric, grouping: ProductivityGrouping) {
    setProductivityMetricState(metric);
    setProductivityGroupingState(grouping);
    setSearchParams(
      writeFilters(filters, heatmapMetric, heatmapCurrency, metric, grouping, latestSearchParams(searchParams)),
      { replace: false }
    );
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
          <StatisticsInsightsSection
            data={statistics.insights.data}
            isLoading={statistics.insights.isLoading}
            isError={statistics.insights.isError}
            onRetry={() => void statistics.insights.refetch()}
          />
          <StatisticsSummaryCards overview={overview} />
          <StatisticsForecastSection
            data={statistics.forecast.data}
            isLoading={statistics.forecast.isLoading}
            isError={statistics.forecast.isError}
            onRetry={() => void statistics.forecast.refetch()}
          />
          <StatisticsComparisonPanel filters={filters} />
          <WorkTypeBreakdown items={breakdown} />
          <StatisticsProductivitySection
            data={statistics.productivity.data}
            isLoading={statistics.productivity.isLoading}
            isError={statistics.productivity.isError}
            onRetry={() => void statistics.productivity.refetch()}
            metric={productivityMetric}
            grouping={productivityGrouping}
            onOptionsChange={setProductivityOptions}
          />
          <StatisticsHighlightsSection
            data={statistics.highlights.data}
            isLoading={statistics.highlights.isLoading}
            isError={statistics.highlights.isError}
            onRetry={() => void statistics.highlights.refetch()}
          />
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

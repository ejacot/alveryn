import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { listEmployments, listWorkTypes } from "../../../api/endpoints";
import { queryKeys } from "../../../api/query-keys";
import { Card } from "../../../components/ui/card";
import { SectionHeading } from "../../../components/ui/section-heading";
import { Download, FileText } from "lucide-react";
import { StatisticsLineChart } from "../charts/statistics-line-chart";
import { StatisticsDrilldownPanel } from "../components/statistics-drilldown-panel";
import { StatisticsFilterBar } from "../components/statistics-filter-bar";
import { StatisticsHeatmap } from "../components/statistics-heatmap";
import {
  StatisticsPrimarySummary,
  StatisticsSummaryCards
} from "../components/statistics-summary";
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
import {
  createDefaultStatisticsFilters,
  updateStatisticsCustomRange
} from "../filters/statistics-filter-state";
import { useStatistics } from "../hooks/use-statistics";
import type {
  ProductivityGrouping,
  ProductivityMetric,
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
    period:
      period && ["today", "week", "month", "year", "custom"].includes(period)
        ? period
        : defaults.period,
    metric:
      metric &&
      ["GROSS", "WORKED_MINUTES", "WORKED_HOURS", "WORKED_DAYS", "ENTRIES"].includes(metric)
        ? metric
        : defaults.metric,
    workTypeIds: searchParams.getAll("workTypeIds").filter(Boolean).sort(),
    calculationMethods: searchParams
      .getAll("calculationMethods")
      .filter(
        (value): value is "TIME_BASED" | "UNIT_BASED" =>
          value === "TIME_BASED" || value === "UNIT_BASED"
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
  return value &&
    ["TOTAL_UNITS", "CONFIGURED_UNITS_PER_HOUR", "EQUIVALENT_MINUTES"].includes(value)
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
  const navigate = useNavigate();
  const { t } = useTranslation("common");
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFiltersState] = useState(() => parseFilters(searchParams));
  const [heatmapMetric, setHeatmapMetricState] = useState(() =>
    parseHeatmapMetric(searchParams)
  );
  const [heatmapCurrency, setHeatmapCurrencyState] = useState(() =>
    searchParams.get("heatmapCurrency")
  );
  const [productivityMetric, setProductivityMetricState] = useState(() =>
    parseProductivityMetric(searchParams)
  );
  const [productivityGrouping, setProductivityGroupingState] = useState(() =>
    parseProductivityGrouping(searchParams)
  );
  const [selectedHeatmapDay, setSelectedHeatmapDay] = useState<string | null>(null);
  const [selectedChartPoint, setSelectedChartPoint] =
    useState<StatisticsTimeSeriesPoint | null>(null);
  const [employmentIds, setEmploymentIds] = useState<string[]>([]);
  const workTypes = useQuery({
    queryKey: queryKeys.workTypes.all(),
    queryFn: listWorkTypes
  });
  const employments = useQuery({
    queryKey: queryKeys.employments.all(),
    queryFn: listEmployments
  });
  const effectiveFilters = useMemo(() => {
    if (employmentIds.length === 0) return filters;
    const allowed = (workTypes.data ?? [])
      .filter((workType) => workType.employmentId && employmentIds.includes(workType.employmentId))
      .map((workType) => workType.id);
    return {
      ...filters,
      workTypeIds: filters.workTypeIds.length > 0
        ? filters.workTypeIds.filter((id) => allowed.includes(id))
        : allowed
    };
  }, [employmentIds, filters, workTypes.data]);
  const statistics = useStatistics(
    effectiveFilters,
    heatmapMetric,
    heatmapCurrency,
    productivityMetric,
    productivityGrouping
  );

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
      writeFilters(
        filters,
        metric,
        currency,
        productivityMetric,
        productivityGrouping,
        latestSearchParams(searchParams)
      ),
      { replace: false }
    );
  }

  function setProductivityOptions(
    metric: ProductivityMetric,
    grouping: ProductivityGrouping
  ) {
    setProductivityMetricState(metric);
    setProductivityGroupingState(grouping);
    setSearchParams(
      writeFilters(
        filters,
        heatmapMetric,
        heatmapCurrency,
        metric,
        grouping,
        latestSearchParams(searchParams)
      ),
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
    <div className="statistics-workspace space-y-6 pb-8">
      <div className="sticky-header-blur -mx-1 flex items-end justify-between gap-3 px-1 pb-3 pt-1">
        <SectionHeading eyebrow={t("statistics.eyebrow")} title={t("statistics.title")} />
        <div className="mb-1 flex gap-2">
          <button type="button" disabled={!overview} onClick={() => overview && exportStatisticsCsv(overview, timeSeries?.points ?? [], breakdown)} className="statistics-export-button disabled:opacity-35" aria-label={t("statistics.export.csv")}>
            <Download className="h-4 w-4" /><span className="hidden sm:inline">CSV</span>
          </button>
          <button type="button" disabled={!overview} onClick={() => overview && navigate(`/settings/export-pdf?from=${filters.from}&to=${filters.to}&returnTo=/statistics`)} className="statistics-export-button disabled:opacity-35" aria-label={t("statistics.export.pdf")}>
            <FileText className="h-4 w-4" /><span className="hidden sm:inline">PDF</span>
          </button>
        </div>
      </div>
      <StatisticsFilterBar
        filters={filters}
        workTypes={workTypes.data ?? []}
        employments={(employments.data ?? []).filter((employment) => employment.active)}
        employmentIds={employmentIds}
        onEmploymentsChange={setEmploymentIds}
        onChange={setFilters}
      />
      {statistics.isError || !overview ? (
        <StatisticsErrorState onRetry={statistics.refetch} />
      ) : !hasEntries ? (
        <StatisticsEmptyState />
      ) : (
        <>
          <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1.28fr)_minmax(19rem,0.72fr)]">
            <Card
              as="section"
              variant="section"
              className="flex min-h-[17rem] flex-col justify-center overflow-hidden px-6 sm:px-8"
            >
              <StatisticsPrimarySummary overview={overview} />
            </Card>
            <StatisticsSummaryCards overview={overview} />
          </div>

          <StatisticsLineChart
            points={timeSeries?.points ?? []}
            comparison={statistics.comparison?.data}
            metric={timeSeries?.metric ?? filters.metric}
            granularity={timeSeries?.granularity ?? "DAILY"}
            onPointSelect={setSelectedChartPoint}
          />
          <StatisticsDrilldownPanel
            filters={filters}
            point={selectedChartPoint}
            onClose={() => setSelectedChartPoint(null)}
          />

          <div className="grid items-start gap-4 lg:grid-cols-2">
            <StatisticsInsightsSection
              data={statistics.insights.data}
              isLoading={statistics.insights.isLoading}
              isError={statistics.insights.isError}
              onRetry={() => void statistics.insights.refetch()}
            />
            <StatisticsForecastSection
              data={statistics.forecast.data}
              isLoading={statistics.forecast.isLoading}
              isError={statistics.forecast.isError}
              onRetry={() => void statistics.forecast.refetch()}
            />
          </div>

          <div className="grid items-start gap-4 lg:grid-cols-2">
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
          </div>

          <div className="grid items-start gap-4 xl:grid-cols-[minmax(18rem,0.72fr)_minmax(0,1.28fr)]">
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
              availableCurrencies={overview.grossByCurrency.map(
                (amount) => amount.currency
              )}
              onOptionsChange={setHeatmapOptions}
              selectedDay={selectedHeatmapDay}
              onSelectDay={setSelectedHeatmapDay}
            />
          </div>
        </>
      )}
    </div>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function exportStatisticsCsv(
  overview: NonNullable<ReturnType<typeof useStatistics>["overview"]["data"]>,
  points: StatisticsTimeSeriesPoint[],
  breakdown: ReturnType<typeof useStatistics>["workTypes"]["data"]
) {
  const rows = [
    ["section", "label", "value", "currency"],
    ...overview.grossByCurrency.map((item) => ["summary", "gross", item.amount, item.currency]),
    ["summary", "worked_minutes", overview.workedMinutes, ""],
    ["summary", "worked_days", String(overview.workedDays), ""],
    ...points.map((point) => ["trend", `${point.bucketStart}/${point.bucketEnd}`, point.value, point.currency ?? ""]),
    ...(breakdown ?? []).flatMap((item) => item.grossByCurrency.length
      ? item.grossByCurrency.map((gross) => ["work_type", item.name, gross.amount, gross.currency])
      : [["work_type", item.name, item.minutes, "minutes"]])
  ];
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), "alveryn-statistics.csv");
}

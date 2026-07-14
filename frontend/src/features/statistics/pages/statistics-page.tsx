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
import type { StatisticsFilters, StatisticsMetric, StatisticsPeriod, StatisticsTimeSeriesPoint } from "../types/statistics";

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

function writeFilters(filters: StatisticsFilters) {
  const params = new URLSearchParams({
    period: filters.period,
    from: filters.from,
    to: filters.to,
    metric: filters.metric
  });
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
  const [selectedHeatmapDay, setSelectedHeatmapDay] = useState<string | null>(null);
  const [selectedChartPoint, setSelectedChartPoint] = useState<StatisticsTimeSeriesPoint | null>(null);
  const workTypes = useQuery({
    queryKey: queryKeys.workTypes.all(),
    queryFn: listWorkTypes
  });
  const statistics = useStatistics(filters);

  useEffect(() => {
    setFiltersState(parseFilters(searchParams));
  }, [searchParams]);

  function setFilters(next: StatisticsFilters) {
    setFiltersState(next);
    setSearchParams(writeFilters(next), { replace: false });
    setSelectedChartPoint(null);
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
            selectedDay={selectedHeatmapDay}
            onSelectDay={setSelectedHeatmapDay}
          />
        </>
      )}
    </div>
  );
}

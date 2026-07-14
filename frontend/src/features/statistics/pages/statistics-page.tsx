import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { listWorkTypes } from "../../../api/endpoints";
import { queryKeys } from "../../../api/query-keys";
import { SectionHeading } from "../../../components/ui/section-heading";
import { StatisticsLineChart } from "../charts/statistics-line-chart";
import { StatisticsFilterBar } from "../components/statistics-filter-bar";
import { StatisticsPrimarySummary, StatisticsSummaryCards } from "../components/statistics-summary";
import {
  StatisticsEmptyState,
  StatisticsErrorState,
  StatisticsHeatmapPlaceholder,
  StatisticsSkeleton
} from "../components/statistics-states";
import { WorkTypeBreakdown } from "../components/work-type-breakdown";
import { createDefaultStatisticsFilters } from "../filters/statistics-filter-state";
import { useStatistics } from "../hooks/use-statistics";

export function StatisticsPage() {
  const { t } = useTranslation("common");
  const [filters, setFilters] = useState(() => createDefaultStatisticsFilters());
  const workTypes = useQuery({
    queryKey: queryKeys.workTypes.all(),
    queryFn: listWorkTypes
  });
  const statistics = useStatistics(filters);

  if (statistics.isLoading) {
    return <StatisticsSkeleton />;
  }

  const overview = statistics.overview.data;
  const points = statistics.timeSeries.data ?? [];
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
          <StatisticsLineChart points={points} />
          <StatisticsSummaryCards overview={overview} />
          <WorkTypeBreakdown items={breakdown} />
          <StatisticsHeatmapPlaceholder />
        </>
      )}
    </div>
  );
}

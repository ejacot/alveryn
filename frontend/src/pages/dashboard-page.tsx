import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getDashboard, getWorkEntries } from "../api/endpoints";
import { DashboardErrorState } from "../components/dashboard/dashboard-error-state";
import { DashboardOverview } from "../components/dashboard/dashboard-overview";
import { DashboardSkeleton } from "../components/dashboard/dashboard-skeleton";
import { getApiError } from "../api/api-errors";
import type { RecentEntry, SummaryMetric } from "../types/dashboard";
import { formatCurrency, formatHours } from "../utils/format";

export function DashboardPage() {
  const {
    data: dashboard,
    isLoading: isDashboardLoading,
    isError: isDashboardError,
    error: dashboardError,
    refetch: refetchDashboard
  } = useQuery({
    queryKey: ["dashboard"],
    queryFn: getDashboard
  });

  const {
    data: workEntries,
    isLoading: isWorkEntriesLoading,
    isError: isWorkEntriesError,
    error: workEntriesError,
    refetch: refetchWorkEntries
  } = useQuery({
    queryKey: ["work-entries", "recent"],
    queryFn: () => getWorkEntries({ page: 0, size: 3 })
  });

  const summary = useMemo<SummaryMetric[]>(() => {
    if (!dashboard) {
      return [];
    }

    return [
      {
        label: "Hours",
        value: formatHours(dashboard.workedHours),
        hint: `Month ${dashboard.currentMonth}`
      },
      {
        label: "Earnings",
        value: formatCurrency(dashboard.grossAmount, "EUR"),
        hint: "Current month gross"
      },
      {
        label: "Entries",
        value: String(dashboard.entriesCount),
        hint: "Tracked this month"
      },
      {
        label: "Absence",
        value: String(dashboard.absenceDays),
        hint: "Days this month"
      }
    ];
  }, [dashboard]);

  const recentEntries = useMemo<RecentEntry[]>(() => {
    if (workEntries?.content?.length) {
      return workEntries.content.map((entry) => ({
        id: entry.id,
        title: entry.workTypeName,
        subtitle: `${entry.calculationMethod.replace("_", " ")} • ${entry.workDate}`,
        amount: formatHours(entry.workedHours)
      }));
    }

    return [];
  }, [workEntries]);

  if (isDashboardLoading || isWorkEntriesLoading) {
    return <DashboardSkeleton />;
  }

  if (isDashboardError || isWorkEntriesError) {
    const errorMessage =
      getApiError(dashboardError ?? workEntriesError).message ||
      "Check the backend connection and try again.";

    return (
      <DashboardErrorState
        message={errorMessage}
        onRetry={() => {
          void refetchDashboard();
          void refetchWorkEntries();
        }}
      />
    );
  }

  return (
    <DashboardOverview summary={summary} recentEntries={recentEntries} />
  );
}

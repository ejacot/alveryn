import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { DashboardErrorState } from "../components/dashboard/dashboard-error-state";
import { DashboardOverview } from "../components/dashboard/dashboard-overview";
import { DashboardSkeleton } from "../components/dashboard/dashboard-skeleton";
import type { RecentEntry, SummaryMetric } from "../types/dashboard";

const previewSummary: SummaryMetric[] = [
  { label: "Today", value: "6.5h", hint: "Focused shift" },
  { label: "Earnings", value: "€126", hint: "Projected gross" },
  { label: "Week", value: "31.0h", hint: "Steady rhythm" },
  { label: "Entries", value: "5", hint: "Recent activity" }
];

const previewEntries: RecentEntry[] = [
  {
    id: "1",
    title: "Morning rooms",
    subtitle: "Housekeeping • 08:00 - 14:30",
    duration: "6h 30m",
    amount: "6.5h"
  },
  {
    id: "2",
    title: "Late shift",
    subtitle: "Lobby reset • Yesterday",
    duration: "4h 00m",
    amount: "4.0h"
  },
  {
    id: "3",
    title: "Weekend prep",
    subtitle: "Suite touch-up • Fri",
    duration: "3h 30m",
    amount: "3.5h"
  }
];

const previewWeeklyBars = [42, 58, 36, 70, 55, 18, 12];

export function PreviewDashboardPage() {
  const [searchParams] = useSearchParams();
  const state = searchParams.get("state");
  const previewWeeklyBarsState = useMemo(
    () => (state === "compact" ? [...previewWeeklyBars, 60, 44, 22] : previewWeeklyBars),
    [state]
  );

  if (state === "loading") {
    return <DashboardSkeleton />;
  }

  if (state === "error") {
    return (
      <DashboardErrorState
        message="Preview-only API failure state for local validation."
        onRetry={() => undefined}
      />
    );
  }

  return (
    <DashboardOverview
      summary={previewSummary}
      recentEntries={previewEntries}
      weeklyBars={previewWeeklyBarsState}
      weeklyDescription="Preview-only rhythm bars for local design validation."
      onQuickAdd={() => undefined}
      preview
    />
  );
}

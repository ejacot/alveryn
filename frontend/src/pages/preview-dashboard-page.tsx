import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { DashboardErrorState } from "../components/dashboard/dashboard-error-state";
import { DashboardOverview } from "../components/dashboard/dashboard-overview";
import { DashboardSkeleton } from "../components/dashboard/dashboard-skeleton";
import type { DashboardSummaryMetrics, RecentEntry } from "../types/dashboard";

const previewWeeklyBars = [42, 58, 36, 70, 55, 18, 12];

export function PreviewDashboardPage() {
  const { t } = useTranslation("dashboard");
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
        message={t("heading.previewError")}
        onRetry={() => undefined}
      />
    );
  }

  const previewSummary: DashboardSummaryMetrics = {
    primaryMetric: {
      label: t("summary.today"),
      value: "6.5h",
      hint: t("preview.summary.focusedShift")
    },
    secondaryMetrics: [
      {
        label: t("preview.summary.earnings"),
        value: "EUR 126",
        hint: t("preview.summary.projectedGross")
      },
      {
        label: t("summary.week"),
        value: "31.0h",
        hint: t("preview.summary.steadyRhythm")
      }
    ],
    tertiaryMetric: {
      label: t("preview.summary.entries"),
      value: "5",
      hint: t("preview.summary.recentActivity")
    }
  };

  const previewEntries: RecentEntry[] = [
    {
      id: "1",
      title: t("preview.entries.morningRooms.title"),
      subtitle: t("preview.entries.morningRooms.subtitle"),
      duration: "6.5h",
      amount: "6.5h"
    },
    {
      id: "2",
      title: t("preview.entries.lateShift.title"),
      subtitle: t("preview.entries.lateShift.subtitle"),
      duration: "4.0h",
      amount: "4.0h"
    },
    {
      id: "3",
      title: t("preview.entries.weekendPrep.title"),
      subtitle: t("preview.entries.weekendPrep.subtitle"),
      duration: "3.5h",
      amount: "3.5h"
    }
  ];

  return (
    <DashboardOverview
      summary={previewSummary}
      recentEntries={previewEntries}
      weeklyBars={previewWeeklyBarsState}
      weeklyDescription={t("preview.weeklyDescription")}
      onQuickAdd={() => undefined}
      preview
    />
  );
}

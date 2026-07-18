import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { DashboardErrorState } from "../components/dashboard/dashboard-error-state";
import { DashboardOverview } from "../components/dashboard/dashboard-overview";
import { DashboardSkeleton } from "../components/dashboard/dashboard-skeleton";
import type {
  DashboardSummaryMetrics,
  SelectedDayOverview,
  WeeklyRhythmDay
} from "../types/dashboard";

const previewWeeklyBars = [42, 58, 36, 70, 55, 18, 12];
const previewWeeklyLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const previewWeeklyStates: WeeklyRhythmDay["status"][] = ["under", "under", "met", "over", "under", "idle", "idle"];
const previewWeeklyMarkers = ["-4", "-2", null, "+1", "-1", null, null];

export function PreviewDashboardPage() {
  const { t } = useTranslation("dashboard");
  const [searchParams] = useSearchParams();
  const state = searchParams.get("state");
  const previewWeeklyDays: WeeklyRhythmDay[] = previewWeeklyBars.map((percentage, index) => ({
    key: `preview-${index}`,
    label: previewWeeklyLabels[index] ?? String(index + 1),
    value: index === 2 ? "6h 30m" : "4h 00m",
    minutes: index === 2 ? 390 : 240,
    amount: index === 2 ? 180 : 120,
    markerLabel: previewWeeklyMarkers[index] ?? null,
    status: previewWeeklyStates[index] ?? "idle",
    percentage,
    selected: index === 2
  }));

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

  const previewSelectedDay: SelectedDayOverview = {
    label: t("selectedDay.today"),
    entriesCount: 1,
    totalDuration: "6.5h",
    totalGross: "EUR 126",
    activities: [
      {
        id: "1",
        title: t("preview.entries.morningRooms.title"),
        kind: "UNIT_BASED",
        subtitle: t("selectedDay.equivalentTime", { duration: "6.5h" }),
        duration: t("selectedDay.equivalentTime", { duration: "6.5h" }),
        amount: "EUR 126",
        unitBreakdown: []
      }
    ]
  };

  return (
    <DashboardOverview
      summary={previewSummary}
      selectedDay={previewSelectedDay}
      weeklyDays={previewWeeklyDays}
      onQuickAdd={() => undefined}
      onCreateAbsence={() => undefined}
      preview
    />
  );
}

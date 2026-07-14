import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate, useOutletContext } from "react-router-dom";
import { listWorkEntriesInRange } from "../api/endpoints";
import { getApiError } from "../api/api-errors";
import { queryKeys } from "../api/query-keys";
import { i18n } from "../i18n";
import { DashboardErrorState } from "../components/dashboard/dashboard-error-state";
import { DashboardOverview } from "../components/dashboard/dashboard-overview";
import { DashboardSkeleton } from "../components/dashboard/dashboard-skeleton";
import type { DashboardSummaryMetrics, RecentEntry } from "../types/dashboard";
import type { WorkEntry } from "../types/work-entry";
import { addDays, formatLocalIsoDate, isSameDay, startOfWeek } from "../utils/date";
import {
  formatCurrency,
  formatMinutesAsDuration,
  formatTimeRange
} from "../utils/format";

type OutletContext = {
  selectedDate?: Date;
};

type MonthRequest = {
  year: number;
  month: number;
};

export function DashboardPage() {
  const { t } = useTranslation(["dashboard", "common"]);
  const navigate = useNavigate();
  const outletContext = useOutletContext<OutletContext>();
  const selectedDate = outletContext?.selectedDate ?? new Date();

  const weekStart = useMemo(() => startOfWeek(selectedDate), [selectedDate]);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart]
  );

  const monthRequests = useMemo<MonthRequest[]>(() => {
    const unique = new Map<string, MonthRequest>();

    [selectedDate, weekStart, weekDays[6]].forEach((date) => {
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      unique.set(`${year}-${month}`, { year, month });
    });

    return Array.from(unique.values());
  }, [selectedDate, weekDays, weekStart]);

  const monthQueries = useQueries({
    queries: monthRequests.map(({ year, month }) => ({
      queryKey: queryKeys.workEntries.range({ year, month }),
      queryFn: () => listWorkEntriesInRange({ year, month })
    }))
  });

  const isLoading = monthQueries.some((query) => query.isLoading);
  const errorQuery = monthQueries.find((query) => query.error);

  const allEntries = useMemo<WorkEntry[]>(() => {
    const merged = new Map<string, WorkEntry>();

    monthQueries.forEach((query) => {
      query.data?.forEach((entry) => {
        merged.set(entry.id, entry);
      });
    });

    return Array.from(merged.values()).sort((left, right) => {
      const leftValue = `${left.workDate}T${left.timeEntry?.startTime ?? "23:59"}`;
      const rightValue = `${right.workDate}T${right.timeEntry?.startTime ?? "23:59"}`;
      return rightValue.localeCompare(leftValue);
    });
  }, [monthQueries]);

  const selectedDayEntries = useMemo(
    () =>
      allEntries.filter((entry) =>
        isSameDay(new Date(`${entry.workDate}T00:00:00`), selectedDate)
      ),
    [allEntries, selectedDate]
  );

  const weeklyEntries = useMemo(
    () =>
      allEntries.filter((entry) => {
        const workDate = new Date(`${entry.workDate}T00:00:00`);
        return weekDays.some((day) => isSameDay(day, workDate));
      }),
    [allEntries, weekDays]
  );

  const selectedDayLabel = useMemo(
    () => formatSelectedDayLabel(selectedDate, t("dashboard:selectedDay.today")),
    [selectedDate, t]
  );

  const summary = useMemo<DashboardSummaryMetrics>(() => {
    const todayMinutes = sumMinutes(selectedDayEntries);
    const todayGross = sumGross(selectedDayEntries);
    const weeklyMinutes = sumMinutes(weeklyEntries);
    const selectedEntriesLabel = t("dashboard:summary.entryCount", {
      count: selectedDayEntries.length
    });
    const weeklyEntriesLabel = t("dashboard:summary.weekEntryCount", {
      count: weeklyEntries.length
    });

    return {
      primaryMetric: {
        label: selectedDayLabel,
        value: formatMinutesAsDuration(todayMinutes),
        hint: selectedDayEntries.length
          ? selectedEntriesLabel
          : t("dashboard:summary.noEntries")
      },
      secondaryMetrics: [
        {
          label: t("dashboard:summary.gross"),
          value: formatCurrency(
            String(todayGross),
            resolveCurrency(selectedDayEntries, weeklyEntries)
          ),
          hint: selectedDayEntries.length
            ? t("dashboard:summary.selectedDay")
            : t("dashboard:summary.noEntries")
        },
        {
          label: t("dashboard:summary.week"),
          value: formatMinutesAsDuration(weeklyMinutes),
          hint: weeklyEntriesLabel
        }
      ],
      tertiaryMetric: {
        label: t("dashboard:summary.recent"),
        value: String(allEntries.length),
        hint: t("dashboard:summary.allEntries")
      }
    };
  }, [allEntries.length, selectedDayEntries, selectedDayLabel, t, weeklyEntries]);

  const recentEntries = useMemo<RecentEntry[]>(
    () =>
      allEntries.slice(0, 5).map((entry) => ({
        id: entry.id,
        title: entry.workTypeName,
        subtitle:
          formatTimeRange(entry.timeEntry?.startTime, entry.timeEntry?.endTime) ??
          t("dashboard:recentEntries.unitRows", {
            count: entry.unitItems.length,
            date: entry.workDate
          }),
        duration: formatMinutesAsDuration(Number(entry.calculatedMinutes)),
        amount: formatCurrency(entry.grossAmount, entry.currencySnapshot)
      })),
    [allEntries, t]
  );

  const weeklyBars = useMemo(() => buildWeekBars(weekDays, weeklyEntries), [weekDays, weeklyEntries]);
  const selectedDayOverview = useMemo(
    () => ({
      label: selectedDayLabel,
      entriesCount: selectedDayEntries.length,
      totalDuration: formatMinutesAsDuration(sumMinutes(selectedDayEntries)),
      totalGross: formatCurrency(
        String(sumGross(selectedDayEntries)),
        resolveCurrency(selectedDayEntries, weeklyEntries)
      ),
      activities: selectedDayEntries.map((entry) => ({
        id: entry.id,
        title: entry.workTypeName,
        kind: entry.calculationMethod,
        subtitle:
          formatTimeRange(entry.timeEntry?.startTime, entry.timeEntry?.endTime) ??
          t("dashboard:selectedDay.equivalentTime", {
            duration: formatMinutesAsDuration(Number(entry.calculatedMinutes))
          }),
        duration:
          entry.calculationMethod === "UNIT_BASED"
            ? t("dashboard:selectedDay.equivalentTime", {
                duration: formatMinutesAsDuration(Number(entry.calculatedMinutes))
              })
            : t("dashboard:selectedDay.workedTime", {
                duration: formatMinutesAsDuration(Number(entry.calculatedMinutes))
              }),
        amount: formatCurrency(entry.grossAmount, entry.currencySnapshot),
        unitBreakdown: entry.unitItems.map((item) =>
          t("dashboard:selectedDay.unitLine", {
            name: item.unitName,
            quantity: formatQuantity(item.quantity)
          })
        )
      }))
    }),
    [selectedDayEntries, selectedDayLabel, t, weeklyEntries]
  );
  const weeklyDescription = useMemo(() => {
    const total = formatMinutesAsDuration(sumMinutes(weeklyEntries));
    return weeklyEntries.length
      ? t("dashboard:weeklyHours.description", { total })
      : t("dashboard:weeklyHours.emptyDescription");
  }, [t, weeklyEntries]);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (errorQuery) {
    return (
      <DashboardErrorState
        message={getApiError(errorQuery.error).message}
        onRetry={() => {
          monthQueries.forEach((query) => {
            void query.refetch();
          });
        }}
      />
    );
  }

  return (
      <DashboardOverview
        summary={summary}
        recentEntries={recentEntries}
        selectedDay={selectedDayOverview}
        weeklyBars={weeklyBars}
        weeklyDescription={weeklyDescription}
        onQuickAdd={() => navigate(`/entries/new?date=${formatLocalIsoDate(selectedDate)}`)}
        onEntrySelect={(entryId) => navigate(`/entries/${entryId}`)}
      />
  );
}

function sumMinutes(entries: WorkEntry[]) {
  return entries.reduce((total, entry) => total + Number(entry.calculatedMinutes), 0);
}

function sumGross(entries: WorkEntry[]) {
  return entries.reduce((total, entry) => total + Number(entry.grossAmount), 0);
}

function resolveCurrency(primary: WorkEntry[], fallback: WorkEntry[]) {
  return primary[0]?.currencySnapshot ?? fallback[0]?.currencySnapshot ?? "EUR";
}

function buildWeekBars(days: Date[], entries: WorkEntry[]) {
  const minutesPerDay = days.map((day) =>
    sumMinutes(
      entries.filter((entry) => isSameDay(new Date(`${entry.workDate}T00:00:00`), day))
    )
  );
  const maxMinutes = Math.max(...minutesPerDay, 0);

  if (maxMinutes === 0) {
    return [];
  }

  return minutesPerDay.map((value) => Math.round((value / maxMinutes) * 100));
}

function formatSelectedDayLabel(date: Date, todayLabel: string) {
  if (isSameDay(date, new Date())) {
    return todayLabel;
  }

  return new Intl.DateTimeFormat(i18n.resolvedLanguage, {
    weekday: "long",
    day: "numeric",
    month: "long"
  }).format(date);
}

function formatQuantity(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }
  return new Intl.NumberFormat(i18n.resolvedLanguage, {
    maximumFractionDigits: 2
  }).format(parsed);
}

import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { useNavigate, useOutletContext } from "react-router-dom";
import { getWorkEntries } from "../api/endpoints";
import { getApiError } from "../api/api-errors";
import { DashboardErrorState } from "../components/dashboard/dashboard-error-state";
import { DashboardOverview } from "../components/dashboard/dashboard-overview";
import { DashboardSkeleton } from "../components/dashboard/dashboard-skeleton";
import type { RecentEntry, SummaryMetric } from "../types/dashboard";
import type { WorkEntry } from "../types/work-entry";
import { addDays, isSameDay, startOfWeek } from "../utils/date";
import {
  formatCurrency,
  formatHours,
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
      queryKey: ["work-entries", year, month],
      queryFn: () => getWorkEntries({ year, month, page: 0, size: 100 })
    }))
  });

  const isLoading = monthQueries.some((query) => query.isLoading);
  const errorQuery = monthQueries.find((query) => query.error);

  const allEntries = useMemo<WorkEntry[]>(() => {
    const merged = new Map<string, WorkEntry>();

    monthQueries.forEach((query) => {
      query.data?.content.forEach((entry) => {
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

  const summary = useMemo<SummaryMetric[]>(() => {
    const todayMinutes = sumMinutes(selectedDayEntries);
    const todayGross = sumGross(selectedDayEntries);
    const weeklyMinutes = sumMinutes(weeklyEntries);

    return [
      {
        label: "Today",
        value: formatMinutesAsDuration(todayMinutes),
        hint: selectedDayEntries.length
          ? `${selectedDayEntries.length} tracked entr${selectedDayEntries.length === 1 ? "y" : "ies"}`
          : "No entries yet"
      },
      {
        label: "Gross",
        value: formatCurrency(String(todayGross), resolveCurrency(selectedDayEntries, weeklyEntries)),
        hint: "Live from saved entries"
      },
      {
        label: "Week",
        value: formatMinutesAsDuration(weeklyMinutes),
        hint: `${weeklyEntries.length} entr${weeklyEntries.length === 1 ? "y" : "ies"} this week`
      },
      {
        label: "Recent",
        value: String(allEntries.length),
        hint: "Loaded from real backend data"
      }
    ];
  }, [allEntries.length, selectedDayEntries, weeklyEntries]);

  const recentEntries = useMemo<RecentEntry[]>(
    () =>
      allEntries.slice(0, 5).map((entry) => ({
        id: entry.id,
        title: entry.workTypeName,
        subtitle:
          formatTimeRange(entry.timeEntry?.startTime, entry.timeEntry?.endTime) ??
          `${entry.unitItems.length} unit row${entry.unitItems.length === 1 ? "" : "s"} • ${entry.workDate}`,
        duration: formatMinutesAsDuration(Number(entry.calculatedMinutes)),
        amount: formatCurrency(entry.grossAmount, entry.currencySnapshot)
      })),
    [allEntries]
  );

  const weeklyBars = useMemo(() => buildWeekBars(weekDays, weeklyEntries), [weekDays, weeklyEntries]);
  const weeklyDescription = useMemo(() => {
    const total = formatMinutesAsDuration(sumMinutes(weeklyEntries));
    return weeklyEntries.length
      ? `${total} tracked across this week. Bars react to real saved entries.`
      : "No entries saved for this week yet. Add your first shift from the quick action above.";
  }, [weeklyEntries]);

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
      weeklyBars={weeklyBars}
      weeklyDescription={weeklyDescription}
      onQuickAdd={() => navigate("/entries/new")}
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

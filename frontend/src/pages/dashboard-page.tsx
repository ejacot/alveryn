import { useMemo } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate, useOutletContext } from "react-router-dom";
import {
  createAbsence,
  getAbsences,
  getPreferences,
  listHourlyRates,
  listWorkEntriesForDay,
  listWorkEntriesInRange
} from "../api/endpoints";
import { getApiError } from "../api/api-errors";
import { queryKeys } from "../api/query-keys";
import { i18n } from "../i18n";
import { DashboardErrorState } from "../components/dashboard/dashboard-error-state";
import { DashboardOverview } from "../components/dashboard/dashboard-overview";
import { DashboardSkeleton } from "../components/dashboard/dashboard-skeleton";
import type { DashboardSummaryMetrics, WeeklyRhythmDay } from "../types/dashboard";
import type { Absence, AbsenceType } from "../types/absence";
import type { WorkEntry } from "../types/work-entry";
import { addDays, addWeeks, formatLocalIsoDate, isSameDay, startOfWeek } from "../utils/date";
import {
  formatCurrency,
  formatMinutesAsDuration,
  formatTimeRange
} from "../utils/format";
import { calculatePaidAbsenceDays } from "../utils/paid-absence";

type OutletContext = {
  selectedDate?: Date;
  setSelectedDate?: (date: Date) => void;
};

type DashboardPageProps = {
  selectedDate?: Date;
};

type MonthRequest = {
  year: number;
  month: number;
};

export function DashboardPage({ selectedDate: selectedDateProp }: DashboardPageProps = {}) {
  const { t } = useTranslation(["dashboard", "common"]);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const outletContext = useOutletContext<OutletContext>();
  const selectedDate = useMemo(
    () => selectedDateProp ?? outletContext?.selectedDate ?? new Date(),
    [outletContext?.selectedDate, selectedDateProp]
  );
  const selectedDateKey = formatLocalIsoDate(selectedDate);

  const weekStart = useMemo(() => startOfWeek(selectedDate), [selectedDate]);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart]
  );
  const weekStartKey = formatLocalIsoDate(weekDays[0]);
  const weekEndKey = formatLocalIsoDate(weekDays[6]);

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
  const selectedDayQuery = useQuery({
    queryKey: queryKeys.workEntries.day(selectedDateKey),
    queryFn: () => listWorkEntriesForDay(selectedDateKey)
  });
  const selectedAbsenceQuery = useQuery({
    queryKey: queryKeys.absences.list({ from: selectedDateKey, to: selectedDateKey }),
    queryFn: () => getAbsences({ from: selectedDateKey, to: selectedDateKey, size: 1 })
  });
  const preferencesQuery = useQuery({
    queryKey: queryKeys.preferences(),
    queryFn: getPreferences
  });
  const hourlyRatesQuery = useQuery({
    queryKey: queryKeys.hourlyRates.all(),
    queryFn: listHourlyRates
  });
  const weeklyAbsencesQuery = useQuery({
    queryKey: queryKeys.absences.list({ from: weekStartKey, to: weekEndKey }),
    queryFn: () => getAbsences({ from: weekStartKey, to: weekEndKey })
  });
  const absenceMutation = useMutation({
    mutationFn: (absenceType: AbsenceType) =>
      createAbsence({
        absenceType,
        startDate: selectedDateKey,
        endDate: selectedDateKey,
        notes: null
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.absences.all() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.absences.list({ from: selectedDateKey, to: selectedDateKey }) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.calendar.activityRange() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.statistics.all() })
      ]);
    }
  });

  const isLoading =
    monthQueries.some((query) => query.isLoading) ||
    selectedDayQuery.isLoading ||
    selectedAbsenceQuery.isLoading ||
    preferencesQuery.isLoading ||
    hourlyRatesQuery.isLoading ||
    weeklyAbsencesQuery.isLoading;
  const errorQuery =
    monthQueries.find((query) => query.error) ??
    (selectedDayQuery.error ? selectedDayQuery : null) ??
    (selectedAbsenceQuery.error ? selectedAbsenceQuery : null) ??
    (preferencesQuery.error ? preferencesQuery : null) ??
    (hourlyRatesQuery.error ? hourlyRatesQuery : null) ??
    (weeklyAbsencesQuery.error ? weeklyAbsencesQuery : null);

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

  const selectedDayEntries = useMemo(() => selectedDayQuery.data ?? [], [selectedDayQuery.data]);
  const selectedAbsence = selectedAbsenceQuery.data?.content[0] ?? null;
  const preferences = preferencesQuery.data ?? null;
  const hourlyRates = useMemo(() => hourlyRatesQuery.data ?? [], [hourlyRatesQuery.data]);
  const weeklyAbsences = useMemo(
    () => weeklyAbsencesQuery.data?.content ?? [],
    [weeklyAbsencesQuery.data]
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
  const selectedDayPaidAbsences = useMemo(
    () =>
      calculatePaidAbsenceDays({
        absences: selectedAbsence ? [selectedAbsence] : [],
        entries: selectedDayEntries,
        hourlyRates,
        preferences,
        from: selectedDateKey,
        to: selectedDateKey
      }),
    [hourlyRates, preferences, selectedAbsence, selectedDateKey, selectedDayEntries]
  );
  const weeklyPaidAbsences = useMemo(
    () =>
      calculatePaidAbsenceDays({
        absences: weeklyAbsences,
        entries: weeklyEntries,
        hourlyRates,
        preferences,
        from: weekStartKey,
        to: weekEndKey
      }),
    [hourlyRates, preferences, weekEndKey, weekStartKey, weeklyAbsences, weeklyEntries]
  );

  const summary = useMemo<DashboardSummaryMetrics>(() => {
    const todayMinutes = sumMinutes(selectedDayEntries) + sumPaidAbsenceMinutes(selectedDayPaidAbsences);
    const todayGross = sumGross(selectedDayEntries) + sumPaidAbsenceGross(selectedDayPaidAbsences);
    const weeklyMinutes = sumMinutes(weeklyEntries) + sumPaidAbsenceMinutes(weeklyPaidAbsences);
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
          value: formatGrossTotal(selectedDayEntries, todayGross, t("dashboard:summary.mixedCurrencies"), selectedDayPaidAbsences),
          hint: selectedDayEntries.length || selectedDayPaidAbsences.length
            ? t("dashboard:summary.selectedDay")
            : t("dashboard:summary.noEntries")
        },
        {
          label: t("dashboard:summary.week"),
          value: formatMinutesAsDuration(weeklyMinutes),
          hint: weeklyEntriesLabel
        }
      ]
    };
  }, [selectedDayEntries, selectedDayLabel, selectedDayPaidAbsences, t, weeklyEntries, weeklyPaidAbsences]);

  const weeklyDays = useMemo(
    () => buildWeeklyRhythmDays(weekDays, weeklyEntries, weeklyAbsences, selectedDate, t),
    [selectedDate, t, weekDays, weeklyAbsences, weeklyEntries]
  );
  const selectedDayOverview = useMemo(
    () => ({
      label: selectedDayLabel,
      entriesCount: selectedDayEntries.length + (selectedAbsence ? 1 : 0),
      totalDuration: formatMinutesAsDuration(sumMinutes(selectedDayEntries) + sumPaidAbsenceMinutes(selectedDayPaidAbsences)),
      totalGross: formatGrossTotal(
        selectedDayEntries,
        sumGross(selectedDayEntries) + sumPaidAbsenceGross(selectedDayPaidAbsences),
        t("dashboard:summary.mixedCurrencies"),
        selectedDayPaidAbsences
      ),
      activities: [
        ...selectedDayEntries.map((entry) => ({
          id: entry.id,
          title: entry.workTypeName,
          kind: entry.calculationMethod,
          subtitle:
            formatTimeRange(entry.timeEntry?.startTime, entry.timeEntry?.endTime) ??
            "",
          duration:
            entry.calculationMethod === "UNIT_BASED"
              ? t("dashboard:selectedDay.equivalentTime", {
                  duration: formatMinutesAsDuration(Number(entry.calculatedMinutes))
                })
              : t("dashboard:selectedDay.workedTime", {
                  duration: formatMinutesAsDuration(Number(entry.calculatedMinutes))
                }),
          amount: formatCurrency(entry.grossAmount, entry.currencySnapshot),
          extraPayLabel: (entry.extraPayPercentage ?? 0) > 0 ? `+${entry.extraPayPercentage}%` : null,
          unitBreakdown: entry.unitItems.map((item) => ({
            id: item.id,
            label: item.unitName,
            quantity: formatQuantity(item.quantity),
            displayOrder: item.displayOrder
          }))
        })),
        ...(selectedAbsence ? [toAbsenceActivity(selectedAbsence, selectedDayPaidAbsences[0]?.minutes ?? 0, t)] : [])
      ]
    }),
    [selectedAbsence, selectedDayEntries, selectedDayLabel, selectedDayPaidAbsences, t]
  );
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
          void selectedDayQuery.refetch();
          void selectedAbsenceQuery.refetch();
          void preferencesQuery.refetch();
          void hourlyRatesQuery.refetch();
          void weeklyAbsencesQuery.refetch();
        }}
      />
    );
  }

  return (
      <DashboardOverview
        summary={summary}
        selectedDay={selectedDayOverview}
        weeklyDays={weeklyDays}
        onQuickAdd={() => navigate(`/entries/new?date=${selectedDateKey}`)}
        onDaySwipe={(direction) => outletContext?.setSelectedDate?.(addDays(selectedDate, direction))}
        onWeekSwipe={(direction) => outletContext?.setSelectedDate?.(addWeeks(selectedDate, direction))}
        onCreateAbsence={(absenceType) => absenceMutation.mutate(absenceType)}
        absencePending={absenceMutation.isPending || Boolean(selectedAbsence)}
        absenceError={absenceMutation.error ? getApiError(absenceMutation.error).message : null}
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

function formatGrossTotal(entries: WorkEntry[], total: number, mixedCurrencyLabel: string, paidAbsences: Array<{ currency: string }> = []) {
  const currencies = new Set([
    ...entries.map((entry) => entry.currencySnapshot),
    ...paidAbsences.map((absence) => absence.currency)
  ]);

  if (currencies.size > 1) {
    return mixedCurrencyLabel;
  }

  return formatCurrency(String(total), entries[0]?.currencySnapshot ?? paidAbsences[0]?.currency ?? "EUR");
}

function sumPaidAbsenceMinutes(absences: Array<{ minutes: number }>) {
  return absences.reduce((total, absence) => total + absence.minutes, 0);
}

function sumPaidAbsenceGross(absences: Array<{ grossAmount: number }>) {
  return absences.reduce((total, absence) => total + absence.grossAmount, 0);
}

function toAbsenceActivity(absence: Absence, paidMinutes: number, t: ReturnType<typeof useTranslation<["dashboard", "common"]>>["t"]) {
  const marker = absenceMarker(absence.absenceType);
  return {
    id: `absence-${absence.id}`,
    title: t(`dashboard:absence.${marker}`),
    kind: "ABSENCE" as const,
    subtitle: t("dashboard:absence.dayOff"),
    duration: paidMinutes > 0
      ? t("dashboard:selectedDay.equivalentTime", {
          duration: formatMinutesAsDuration(paidMinutes)
        })
      : t("dashboard:absence.noWork"),
    amount: "",
    unitBreakdown: [],
    marker
  };
}

function absenceMarker(absenceType: AbsenceType) {
  if (absenceType === "SICK_LEAVE") {
    return "sick" as const;
  }
  if (absenceType === "VACATION") {
    return "vacation" as const;
  }
  return "free" as const;
}

const DAILY_TARGET_MINUTES = 8 * 60;

function buildWeeklyRhythmDays(
  days: Date[],
  entries: WorkEntry[],
  absences: Absence[],
  selectedDate: Date,
  t: ReturnType<typeof useTranslation<["dashboard", "common"]>>["t"]
): WeeklyRhythmDay[] {
  const minutesPerDay = days.map((day) =>
    sumMinutes(
      entries.filter((entry) => isSameDay(new Date(`${entry.workDate}T00:00:00`), day))
    )
  );
  return days.map((day, index) => {
    const absence = absences.find((item) => absenceCoversDate(item, day));
    const absenceType = absence ? absenceMarker(absence.absenceType) : null;
    const minutes = minutesPerDay[index] ?? 0;
    const hasEntries = minutes > 0;
    const difference = minutes - DAILY_TARGET_MINUTES;
    const status = absence && !hasEntries
      ? "absence"
      : !hasEntries
      ? "idle"
      : difference < 0
        ? "under"
        : difference > 0
          ? "over"
          : "met";

    return {
      key: formatLocalIsoDate(day),
      label: new Intl.DateTimeFormat(i18n.resolvedLanguage, {
        weekday: "short"
      }).format(day),
      value: formatMinutesAsDuration(minutes),
      markerLabel: hasEntries && difference !== 0 ? formatTargetDifferenceMarker(difference) : null,
      status,
      absence: absenceType
        ? {
            type: absenceType,
            label: t(`dashboard:absence.${absenceType}`)
          }
        : null,
      percentage: Math.min(Math.round((minutes / DAILY_TARGET_MINUTES) * 100), 150),
      selected: isSameDay(day, selectedDate)
    };
  });
}

function absenceCoversDate(absence: Absence, date: Date) {
  const key = formatLocalIsoDate(date);
  return absence.startDate <= key && absence.endDate >= key;
}

function formatTargetDifferenceMarker(minutes: number) {
  const hours = Math.abs(minutes) / 60;
  const prefix = minutes > 0 ? "+" : "-";
  return new Intl.NumberFormat(i18n.resolvedLanguage, {
    maximumFractionDigits: 1
  }).format(hours).replace(/^/, prefix);
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

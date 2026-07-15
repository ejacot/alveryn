import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate, useOutletContext } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getCalendarActivityRange, getPreferences, listAbsencesInRange, listHourlyRates, listWorkEntriesInRange } from "../api/endpoints";
import { getApiError } from "../api/api-errors";
import { queryKeys } from "../api/query-keys";
import { Button } from "../components/ui/button";
import { CalendarErrorState } from "../components/calendar/calendar-error-state";
import { CalendarMonthGrid } from "../components/calendar/calendar-month-grid";
import { CalendarMonthSummary } from "../components/calendar/calendar-month-summary";
import { CalendarSelectedDayPanel } from "../components/calendar/calendar-selected-day-panel";
import { CalendarSkeleton } from "../components/calendar/calendar-skeleton";
import {
  addDays,
  absenceOverlapsDate,
  buildMonthGrid,
  countMonthOverlapDays,
  formatMonthLabel,
  formatSelectedDate,
  getNextMonthDate,
  getPreviousMonthDate,
  isSameMonth,
  resolveMonthSwipeDirection,
  startOfMonth,
  toIsoDate
} from "../features/calendar/calendar-utils";
import type { Absence } from "../types/absence";
import type { WorkEntry } from "../types/work-entry";
import { formatCurrency, formatMinutesAsDuration } from "../utils/format";
import { calculatePaidAbsenceDays } from "../utils/paid-absence";

const EMPTY_WORK_ENTRIES: WorkEntry[] = [];
const EMPTY_ABSENCES: Absence[] = [];

type OutletContext = {
  setSelectedDate?: (date: Date) => void;
};

function compareEntriesByStartTime(first: WorkEntry, second: WorkEntry) {
  const firstStart = first.timeEntry?.startTime ?? "99:99";
  const secondStart = second.timeEntry?.startTime ?? "99:99";

  if (firstStart !== secondStart) {
    return firstStart.localeCompare(secondStart);
  }

  return first.createdAt.localeCompare(second.createdAt);
}

export function CalendarPage() {
  const navigate = useNavigate();
  const outletContext = useOutletContext<OutletContext>();
  const { t } = useTranslation("calendar");
  const queryClient = useQueryClient();
  const today = useMemo(() => new Date(), []);
  const [activeMonth, setActiveMonth] = useState(() => startOfMonth(today));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [slideDirection, setSlideDirection] = useState(0);

  const year = activeMonth.getFullYear();
  const month = activeMonth.getMonth() + 1;

  const workEntriesQuery = useQuery({
    queryKey: queryKeys.workEntries.range({ year, month }),
    queryFn: () => listWorkEntriesInRange({ year, month })
  });

  const absencesQuery = useQuery({
    queryKey: queryKeys.absences.range({ year, month }),
    queryFn: () => listAbsencesInRange({ year, month })
  });

  const activityRangeQuery = useQuery({
    queryKey: queryKeys.calendar.activityRange(),
    queryFn: getCalendarActivityRange
  });
  const preferencesQuery = useQuery({
    queryKey: queryKeys.preferences(),
    queryFn: getPreferences
  });
  const hourlyRatesQuery = useQuery({
    queryKey: queryKeys.hourlyRates.all(),
    queryFn: listHourlyRates
  });

  useEffect(() => {
    const previousMonth = getPreviousMonthDate(activeMonth);
    const nextMonth = getNextMonthDate(activeMonth);

    void queryClient.prefetchQuery({
      queryKey: queryKeys.workEntries.range({
        year: previousMonth.getFullYear(),
        month: previousMonth.getMonth() + 1
      }),
      queryFn: () =>
        listWorkEntriesInRange({
          year: previousMonth.getFullYear(),
          month: previousMonth.getMonth() + 1
        })
    });
    void queryClient.prefetchQuery({
      queryKey: queryKeys.workEntries.range({
        year: nextMonth.getFullYear(),
        month: nextMonth.getMonth() + 1
      }),
      queryFn: () =>
        listWorkEntriesInRange({
          year: nextMonth.getFullYear(),
          month: nextMonth.getMonth() + 1
        })
    });
    void queryClient.prefetchQuery({
      queryKey: queryKeys.absences.range({
        year: previousMonth.getFullYear(),
        month: previousMonth.getMonth() + 1
      }),
      queryFn: () =>
        listAbsencesInRange({
          year: previousMonth.getFullYear(),
          month: previousMonth.getMonth() + 1
        })
    });
    void queryClient.prefetchQuery({
      queryKey: queryKeys.absences.range({
        year: nextMonth.getFullYear(),
        month: nextMonth.getMonth() + 1
      }),
      queryFn: () =>
        listAbsencesInRange({
          year: nextMonth.getFullYear(),
          month: nextMonth.getMonth() + 1
        })
    });
  }, [activeMonth, queryClient]);

  const isLoading = workEntriesQuery.isLoading || absencesQuery.isLoading || preferencesQuery.isLoading || hourlyRatesQuery.isLoading;
  const error = workEntriesQuery.error ?? absencesQuery.error ?? preferencesQuery.error ?? hourlyRatesQuery.error;
  const entries = workEntriesQuery.data ?? EMPTY_WORK_ENTRIES;
  const absences = absencesQuery.data ?? EMPTY_ABSENCES;
  const preferences = preferencesQuery.data ?? null;
  const hourlyRates = useMemo(() => hourlyRatesQuery.data ?? [], [hourlyRatesQuery.data]);
  const firstActivityDate = activityRangeQuery.data?.firstActivityDate ?? null;
  const todayIso = toIsoDate(today);

  const monthGrid = useMemo(() => buildMonthGrid(activeMonth), [activeMonth]);

  const entriesByDate = useMemo(() => {
    const grouped = new Map<string, WorkEntry[]>();
    entries.forEach((entry) => {
      const bucket = grouped.get(entry.workDate) ?? [];
      bucket.push(entry);
      grouped.set(entry.workDate, bucket);
    });
    return grouped;
  }, [entries]);

  const absenceByDate = useMemo(() => {
    const grouped = new Map<string, Absence>();
    monthGrid.forEach((day) => {
      const found = absences.find((absence) => absenceOverlapsDate(absence, day.date));
      if (found) {
        grouped.set(day.key, found);
      }
    });
    return grouped;
  }, [absences, monthGrid]);

  useEffect(() => {
    if (selectedDate !== null && !isSameMonth(selectedDate, activeMonth)) {
      setSelectedDate(null);
    }
  }, [activeMonth, selectedDate]);

  const selectedEntries = useMemo(
    () => (selectedDate ? [...(entriesByDate.get(toIsoDate(selectedDate)) ?? [])].sort(compareEntriesByStartTime) : []),
    [entriesByDate, selectedDate]
  );

  const selectedAbsence = useMemo(
    () => (selectedDate ? absenceByDate.get(toIsoDate(selectedDate)) ?? null : null),
    [absenceByDate, selectedDate]
  );

  const selectedPaidAbsenceMinutes = useMemo(() => {
    if (!selectedDate || !selectedAbsence) {
      return 0;
    }

    const selectedDateKey = toIsoDate(selectedDate);
    return calculatePaidAbsenceDays({
      absences: [selectedAbsence],
      entries: selectedEntries,
      hourlyRates,
      preferences,
      from: selectedDateKey,
      to: selectedDateKey
    }).reduce((total, absence) => total + absence.minutes, 0);
  }, [hourlyRates, preferences, selectedAbsence, selectedDate, selectedEntries]);

  const summary = useMemo(() => {
    const monthStart = toIsoDate(startOfMonth(activeMonth));
    const monthEnd = toIsoDate(addDays(getNextMonthDate(activeMonth), -1));
    const paidAbsences = calculatePaidAbsenceDays({
      absences,
      entries,
      hourlyRates,
      preferences,
      from: monthStart,
      to: monthEnd
    });
    const workedMinutes = entries.reduce(
      (total, entry) => total + Number(entry.calculatedMinutes),
      0
    );
	    const paidAbsenceMinutes = paidAbsences.reduce((total, absence) => total + absence.minutes, 0);
	    const extraPaidMinutes = entries.reduce(
	      (total, entry) =>
	        total + Number(entry.calculatedMinutes) * ((entry.extraPayPercentage ?? 0) / 100),
	      0
	    );
	    const grossAmount = entries.reduce(
	      (total, entry) => total + Number(entry.grossAmount),
	      0
    ) + paidAbsences.reduce((total, absence) => total + absence.grossAmount, 0);
    const absenceDays = absences.reduce(
      (total, absence) => total + countMonthOverlapDays(absence, activeMonth),
      0
    );
    const workedDays = new Set(entries.map((entry) => entry.workDate)).size;
    const currencies = new Set([
      ...entries.map((entry) => entry.currencySnapshot),
      ...paidAbsences.map((absence) => absence.currency)
    ]);
    const currency = entries[0]?.currencySnapshot ?? paidAbsences[0]?.currency ?? "EUR";

	    return {
	      workedHours: formatMinutesAsDuration(workedMinutes),
	      paidTotalHours: formatMinutesAsDuration(paidAbsenceMinutes + extraPaidMinutes),
	      paidAbsenceHours: formatMinutesAsDuration(paidAbsenceMinutes),
	      grossAmount: currencies.size > 1 ? t("monthlySummary.mixedCurrencies") : formatCurrency(String(grossAmount), currency),
	      workedDays,
      absenceDays
    };
  }, [absences, activeMonth, entries, hourlyRates, preferences, t]);

  function changeMonth(direction: -1 | 1) {
    const nextMonth = direction === -1 ? getPreviousMonthDate(activeMonth) : getNextMonthDate(activeMonth);
    setSlideDirection(direction);
    setActiveMonth(nextMonth);
    setSelectedDate(null);
  }

  if (isLoading) {
    return <CalendarSkeleton />;
  }

  if (error) {
    return (
      <CalendarErrorState
        message={getApiError(error).message}
        onRetry={() => {
          void workEntriesQuery.refetch();
          void absencesQuery.refetch();
          void preferencesQuery.refetch();
          void hourlyRatesQuery.refetch();
        }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-[860px] space-y-5 pb-28">
      <header>
        <h1 className="text-[2rem] font-semibold tracking-[-0.07em] text-white">
          {t("title")}
        </h1>
      </header>

      <section className="space-y-2">
        <div className="hidden items-center justify-end gap-2 md:flex">
          <Button
            variant="ghost"
            className="h-10 min-h-10 rounded-full border border-white/[0.06] bg-white/[0.02] px-4 text-white/50 hover:bg-white/[0.035]"
            onClick={() => changeMonth(-1)}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            className="h-10 min-h-10 rounded-full border border-white/[0.06] bg-white/[0.02] px-4 text-white/50 hover:bg-white/[0.035]"
            onClick={() => changeMonth(1)}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <CalendarMonthGrid
          monthLabel={formatMonthLabel(activeMonth)}
          monthKey={`${year}-${month}`}
          slideDirection={slideDirection}
          days={monthGrid}
          selectedDate={selectedDate}
          today={today}
          getDayMeta={(isoDate) => {
            const entriesCount = entriesByDate.get(isoDate)?.length ?? 0;
            const inTrackedRange = isInTrackedRange(isoDate, firstActivityDate, todayIso);
            const marker = absenceByDate.get(isoDate)?.absenceType ?? null;
            return {
              entriesCount,
              marker,
              noActivityInTrackedRange: inTrackedRange && entriesCount === 0 && !marker
            };
          }}
          onSelect={(date) => {
            setSelectedDate(date);
            outletContext?.setSelectedDate?.(date);
            if (!isSameMonth(date, activeMonth)) {
              setActiveMonth(startOfMonth(date));
            }
          }}
          onSwipeChange={changeMonth}
          onResolveSwipe={resolveMonthSwipeDirection}
        />
      </section>

      <CalendarMonthSummary {...summary} />

      {selectedDate ? (
        <div className="pt-5">
          <CalendarSelectedDayPanel
            title={formatSelectedDate(selectedDate)}
            entries={selectedEntries}
            absence={selectedAbsence}
            paidAbsenceMinutes={selectedPaidAbsenceMinutes}
            onEntrySelect={(entryId) =>
              navigate(`/entries/${entryId}`, { state: { returnTo: "/calendar" } })
            }
          />
        </div>
      ) : null}
    </div>
  );
}

function isInTrackedRange(isoDate: string, firstActivityDate: string | null, todayIso: string) {
  return Boolean(firstActivityDate && isoDate >= firstActivityDate && isoDate <= todayIso);
}

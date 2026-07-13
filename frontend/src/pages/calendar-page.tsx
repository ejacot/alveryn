import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { getAbsences, getWorkEntries } from "../api/endpoints";
import { getApiError } from "../api/api-errors";
import { AppLogo } from "../components/branding/app-logo";
import { Button } from "../components/ui/button";
import { CalendarErrorState } from "../components/calendar/calendar-error-state";
import { CalendarMonthGrid } from "../components/calendar/calendar-month-grid";
import { CalendarMonthSummary } from "../components/calendar/calendar-month-summary";
import { CalendarSelectedDayPanel } from "../components/calendar/calendar-selected-day-panel";
import { CalendarSkeleton } from "../components/calendar/calendar-skeleton";
import {
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

export function CalendarPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const today = useMemo(() => new Date(), []);
  const [activeMonth, setActiveMonth] = useState(() => startOfMonth(today));
  const [selectedDate, setSelectedDate] = useState(() => today);
  const [slideDirection, setSlideDirection] = useState(0);

  const year = activeMonth.getFullYear();
  const month = activeMonth.getMonth() + 1;

  const workEntriesQuery = useQuery({
    queryKey: ["work-entries", year, month],
    queryFn: () => getWorkEntries({ year, month, page: 0, size: 100 })
  });

  const absencesQuery = useQuery({
    queryKey: ["absences", year, month],
    queryFn: () => getAbsences({ year, month, page: 0, size: 100 })
  });

  useEffect(() => {
    const previousMonth = getPreviousMonthDate(activeMonth);
    const nextMonth = getNextMonthDate(activeMonth);

    void queryClient.prefetchQuery({
      queryKey: ["work-entries", previousMonth.getFullYear(), previousMonth.getMonth() + 1],
      queryFn: () =>
        getWorkEntries({
          year: previousMonth.getFullYear(),
          month: previousMonth.getMonth() + 1,
          page: 0,
          size: 100
        })
    });
    void queryClient.prefetchQuery({
      queryKey: ["work-entries", nextMonth.getFullYear(), nextMonth.getMonth() + 1],
      queryFn: () =>
        getWorkEntries({
          year: nextMonth.getFullYear(),
          month: nextMonth.getMonth() + 1,
          page: 0,
          size: 100
        })
    });
    void queryClient.prefetchQuery({
      queryKey: ["absences", previousMonth.getFullYear(), previousMonth.getMonth() + 1],
      queryFn: () =>
        getAbsences({
          year: previousMonth.getFullYear(),
          month: previousMonth.getMonth() + 1,
          page: 0,
          size: 100
        })
    });
    void queryClient.prefetchQuery({
      queryKey: ["absences", nextMonth.getFullYear(), nextMonth.getMonth() + 1],
      queryFn: () =>
        getAbsences({
          year: nextMonth.getFullYear(),
          month: nextMonth.getMonth() + 1,
          page: 0,
          size: 100
        })
    });
  }, [activeMonth, queryClient]);

  const isLoading = workEntriesQuery.isLoading || absencesQuery.isLoading;
  const error = workEntriesQuery.error ?? absencesQuery.error;
  const entries = workEntriesQuery.data?.content ?? [];
  const absences = absencesQuery.data?.content ?? [];

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
    if (!isSameMonth(selectedDate, activeMonth)) {
      setSelectedDate(startOfMonth(activeMonth));
    }
  }, [activeMonth, selectedDate]);

  const selectedEntries = useMemo(
    () => entriesByDate.get(toIsoDate(selectedDate)) ?? [],
    [entriesByDate, selectedDate]
  );

  const selectedAbsence = useMemo(
    () => absenceByDate.get(toIsoDate(selectedDate)) ?? null,
    [absenceByDate, selectedDate]
  );

  const summary = useMemo(() => {
    const workedMinutes = entries.reduce(
      (total, entry) => total + Number(entry.calculatedMinutes),
      0
    );
    const grossAmount = entries.reduce(
      (total, entry) => total + Number(entry.grossAmount),
      0
    );
    const absenceDays = absences.reduce(
      (total, absence) => total + countMonthOverlapDays(absence, activeMonth),
      0
    );
    const currency = entries[0]?.currencySnapshot ?? "EUR";

    return {
      workedHours: formatMinutesAsDuration(workedMinutes),
      grossAmount: formatCurrency(String(grossAmount), currency),
      entriesCount: entries.length,
      absenceDays
    };
  }, [absences, activeMonth, entries]);

  function changeMonth(direction: -1 | 1) {
    const nextMonth = direction === -1 ? getPreviousMonthDate(activeMonth) : getNextMonthDate(activeMonth);
    setSlideDirection(direction);
    setActiveMonth(nextMonth);
    setSelectedDate((current) => {
      const desiredDay = current.getDate();
      const candidate = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), desiredDay);
      if (candidate.getMonth() !== nextMonth.getMonth()) {
        return startOfMonth(nextMonth);
      }
      candidate.setHours(12, 0, 0, 0);
      return candidate;
    });
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
        }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-[860px] space-y-9 pb-8">
      <section className="space-y-6">
        <div className="flex items-start justify-between gap-5">
          <div className="space-y-4">
            <AppLogo className="justify-start" />
            <h1 className="text-[2.25rem] font-semibold tracking-[-0.08em] text-white">
              {formatMonthLabel(activeMonth)}
            </h1>
          </div>

          <button
            type="button"
            aria-label="Go to current month"
            onClick={() => {
              setSlideDirection(0);
              setActiveMonth(startOfMonth(today));
              setSelectedDate(today);
            }}
            className="mt-1 flex h-14 w-14 items-center justify-center rounded-[20px] border border-white/[0.05] bg-white/[0.02] shadow-[0_18px_40px_rgba(0,0,0,0.18)] backdrop-blur-[18px] transition hover:bg-white/[0.035] focus:outline-none focus:ring-2 focus:ring-white/20"
          >
            <CalendarDays className="h-[22px] w-[22px] text-white/72" />
          </button>
        </div>

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
          monthKey={`${year}-${month}`}
          slideDirection={slideDirection}
          days={monthGrid}
          selectedDate={selectedDate}
          today={today}
          getDayMeta={(isoDate) => ({
            entriesCount: entriesByDate.get(isoDate)?.length ?? 0,
            hasAbsence: absenceByDate.has(isoDate)
          })}
          onSelect={(date) => {
            setSelectedDate(date);
            if (!isSameMonth(date, activeMonth)) {
              setActiveMonth(startOfMonth(date));
            }
          }}
          onSwipeChange={changeMonth}
          onResolveSwipe={resolveMonthSwipeDirection}
        />
      </section>

      <CalendarMonthSummary {...summary} />

      <CalendarSelectedDayPanel
        title={formatSelectedDate(selectedDate)}
        entries={selectedEntries}
        absence={selectedAbsence}
        onAddEntry={() =>
          navigate(`/entries/new?date=${toIsoDate(selectedDate)}`, {
            state: { returnTo: "/calendar" }
          })
        }
        onEntrySelect={(entryId) =>
          navigate(`/entries/${entryId}`, { state: { returnTo: "/calendar" } })
        }
      />
    </div>
  );
}

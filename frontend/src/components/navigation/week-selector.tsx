import { useMemo, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { getCalendarActivityRange, listAbsencesInRange, listWorkEntriesInRange } from "../../api/endpoints";
import { queryKeys } from "../../api/query-keys";
import { addDays, formatLocalIsoDate, getWeekDays, isSameDay, startOfWeek } from "../../utils/date";
import { cn } from "../../utils/cn";
import {
  getNextWeekDate,
  getPreviousWeekDate,
  resolveWeekSwipeDirection
} from "./week-selector.utils";

type Props = {
  value: Date;
  onChange: (date: Date) => void;
};

export function WeekSelector({ value, onChange }: Props) {
  const [slideDirection, setSlideDirection] = useState(0);
  const days = useMemo(() => getWeekDays(value), [value]);
  const today = new Date();
  const weekStart = useMemo(() => startOfWeek(value), [value]);
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const monthRequests = useMemo(() => {
    const unique = new Map<string, { year: number; month: number }>();

    [weekStart, weekEnd].forEach((date) => {
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      unique.set(`${year}-${month}`, { year, month });
    });

    return Array.from(unique.values());
  }, [weekEnd, weekStart]);
  const entryQueries = useQueries({
    queries: monthRequests.map(({ year, month }) => ({
      queryKey: queryKeys.workEntries.range({ year, month }),
      queryFn: () => listWorkEntriesInRange({ year, month })
    }))
  });
  const absenceQueries = useQueries({
    queries: monthRequests.map(({ year, month }) => ({
      queryKey: queryKeys.absences.range({ year, month }),
      queryFn: () => listAbsencesInRange({ year, month })
    }))
  });
  const activityRangeQuery = useQuery({
    queryKey: queryKeys.calendar.activityRange(),
    queryFn: getCalendarActivityRange
  });
  const markedDates = useMemo(() => {
    const dates = new Set<string>();
    entryQueries.forEach((query) => {
      query.data?.forEach((entry) => dates.add(entry.workDate));
    });
    return dates;
  }, [entryQueries]);
  const absenceByDate = useMemo(() => {
    const absences = new Map<string, "DAY_OFF" | "SICK_LEAVE" | "VACATION" | "PUBLIC_HOLIDAY">();
    absenceQueries.forEach((query) => {
      query.data?.forEach((absence) => {
        days.forEach((day) => {
          const dateKey = formatLocalIsoDate(day.date);
          if (absence.startDate <= dateKey && absence.endDate >= dateKey) {
            absences.set(dateKey, absence.absenceType);
          }
        });
      });
    });
    return absences;
  }, [absenceQueries, days]);
  const firstActivityDate = activityRangeQuery.data?.firstActivityDate ?? null;
  const todayKey = formatLocalIsoDate(today);
  const monthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        month: "long",
        year: "numeric"
      }).format(value),
    [value]
  );
  const weekKey = formatLocalIsoDate(weekStart);

  function shiftWeek(direction: -1 | 1) {
    setSlideDirection(direction);
    onChange(direction === -1 ? getPreviousWeekDate(value) : getNextWeekDate(value));
  }

  return (
    <section className="space-y-2.5 overflow-hidden">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="hairline-text">
            {monthLabel}
          </h2>
        </div>
      </div>
      <div className="relative min-h-[84px] touch-pan-y overflow-hidden">
        <AnimatePresence custom={slideDirection} initial={false}>
          <motion.div
            key={weekKey}
            custom={slideDirection}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.08}
            dragDirectionLock
            onDragEnd={(_, info) => {
              const direction = resolveWeekSwipeDirection(info);
              if (direction === -1) {
                shiftWeek(-1);
              } else if (direction === 1) {
                shiftWeek(1);
              }
            }}
            variants={{
              enter: (direction: number) => ({
                x: direction === 0 ? 0 : direction > 0 ? "100%" : "-100%"
              }),
              center: {
                x: 0
              },
              exit: (direction: number) => ({
                x: direction > 0 ? "-100%" : "100%"
              })
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            className="absolute inset-0 grid grid-cols-7 gap-1"
          >
            {days.map((day) => {
              const selected = isSameDay(day.date, value);
              const current = !selected && isSameDay(day.date, today);
              const dateKey = formatLocalIsoDate(day.date);
              const hasEntries = markedDates.has(dateKey);
              const absenceType = absenceByDate.get(dateKey) ?? null;
              const isTrackedEmptyDay = Boolean(firstActivityDate && dateKey >= firstActivityDate && dateKey <= todayKey && !hasEntries && !absenceType);
              const state = selected ? "selected" : current ? "today" : "default";

              return (
                <motion.button
                  key={day.key}
                  type="button"
                  aria-pressed={selected}
                  aria-label={`${day.weekday} ${day.dayNumber}`}
                  data-state={state}
                  onClick={() => onChange(day.date)}
                  className="flex min-h-[74px] flex-col items-center justify-between rounded-[24px] px-1 py-1.5 focus:outline-none focus:ring-2 focus:ring-white/28 focus:ring-offset-2 focus:ring-offset-[#050505]"
                >
                  <span className="text-[10px] font-semibold tracking-[0.2em] text-white/34">
                    {day.weekday.slice(0, 3)}
                  </span>
                  <motion.div
                    layout
                    className={cn(
                      "relative flex h-11 w-11 items-center justify-center rounded-full text-[15px] font-semibold transition",
                      selected
                        ? "bg-white text-black shadow-[0_10px_30px_rgba(255,255,255,0.12)]"
                        : current
                          ? cn(
                              "border border-white/[0.08] bg-white/[0.1]",
                              isTrackedEmptyDay ? "text-red-300" : "text-white/88"
                            )
                          : isTrackedEmptyDay ? "text-red-300" : "text-white/76"
                    )}
                  >
                    {day.dayNumber}
                  </motion.div>
                  <span
                    className={cn(
                      "block h-2 w-2 rounded-full transition",
	                      (absenceType === "DAY_OFF" || absenceType === "PUBLIC_HOLIDAY") && (selected ? "absence-dot-free border border-black/60" : "absence-dot-free border border-white/34"),
                      absenceType === "SICK_LEAVE" && "bg-red-500/90",
                      absenceType === "VACATION" && "bg-emerald-500/90",
                      !absenceType && hasEntries
                        ? selected
                          ? "bg-black/68"
                          : current
                            ? "bg-white/72"
                            : "bg-white/46"
                        : !absenceType ? "bg-transparent" : null
                    )}
                    aria-hidden="true"
                  />
                </motion.button>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}

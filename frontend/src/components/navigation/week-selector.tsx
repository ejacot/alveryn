import { useMemo, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  getCalendarActivityRange,
  listAbsenceTypes,
  listAbsencesInRange,
  listWorkRecordsInRange
} from "../../api/endpoints";
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
  showMonthLabel?: boolean;
};

export function WeekSelector({ value, onChange, showMonthLabel = true }: Props) {
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
  const weekRecordsQuery = useQuery({
    queryKey: queryKeys.workRecords.range({
      from: formatLocalIsoDate(weekStart),
      to: formatLocalIsoDate(weekEnd)
    }),
    queryFn: () =>
      listWorkRecordsInRange({
        from: formatLocalIsoDate(weekStart),
        to: formatLocalIsoDate(weekEnd)
      })
  });
  const absenceTypesQuery = useQuery({
    queryKey: queryKeys.absenceTypes.list(true),
    queryFn: () => listAbsenceTypes(true)
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
    weekRecordsQuery.data?.forEach((record) => dates.add(record.workDate));
    return dates;
  }, [weekRecordsQuery.data]);
  const absenceByDate = useMemo(() => {
    const absences = new Map<string, { type: "DAY_OFF" | "SICK_LEAVE" | "VACATION" | "PUBLIC_HOLIDAY"; color: string }>();
    absenceQueries.forEach((query) => {
      query.data?.forEach((absence) => {
        const color = absenceTypesQuery.data?.find((type) => type.id === absence.absenceTypeId)?.color
          ?? defaultAbsenceColor(absence.absenceType);
        days.forEach((day) => {
          const dateKey = formatLocalIsoDate(day.date);
          if (absence.startDate <= dateKey && absence.endDate >= dateKey) {
            absences.set(dateKey, { type: absence.absenceType, color });
          }
        });
      });
    });
    return absences;
  }, [absenceQueries, absenceTypesQuery.data, days]);
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
      {showMonthLabel ? <div className="flex items-end justify-between">
        <div>
          <h2 className="hairline-text">
            {monthLabel}
          </h2>
        </div>
      </div> : null}
      <div className="relative min-h-[62px] touch-pan-y overflow-hidden">
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
              const absence = absenceByDate.get(dateKey) ?? null;
              const absenceType = absence?.type ?? null;
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
                  className={cn(
                    "flex min-h-[58px] flex-col items-center justify-center gap-1 px-1 py-1.5 transition focus:outline-none focus:ring-2 focus:ring-white/28 focus:ring-offset-2 focus:ring-offset-[#050505]",
                    selected
                      ? "week-day-selected rounded-[18px] bg-white text-black shadow-[0_12px_34px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.8)]"
                      : "rounded-[24px]"
                  )}
                >
                  <span className={cn(
                    "text-[10px] font-semibold tracking-[0.2em]",
                    selected ? "week-day-selected-secondary text-black/55" : "text-white/34"
                  )}>
                    {day.weekday.slice(0, 3)}
                  </span>
                  <motion.div
                    layout
                    style={!selected && absence ? { color: absence.color } : undefined}
                    className={cn(
                      "relative flex h-8 w-full items-center justify-center text-[15px] font-semibold transition",
                      selected
                        ? "text-black"
                        : current
                          ? cn(
                              "mx-auto w-11 rounded-full border border-white/[0.08] bg-white/[0.1]",
                              isTrackedEmptyDay ? "text-red-300" : "text-white/88"
                            )
                          : cn(
                              "mx-auto w-11 rounded-full",
                              isTrackedEmptyDay ? "text-red-300" : "text-white/76"
                            )
                    )}
                  >
                    {day.dayNumber}
                  </motion.div>
                </motion.button>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}

function defaultAbsenceColor(type: "DAY_OFF" | "SICK_LEAVE" | "VACATION" | "PUBLIC_HOLIDAY") {
  if (type === "SICK_LEAVE") return "#ef4444";
  if (type === "VACATION") return "#22c55e";
  return "#737373";
}

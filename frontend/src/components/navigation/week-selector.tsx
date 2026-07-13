import { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { getWorkEntries } from "../../api/endpoints";
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
  const days = getWeekDays(value);
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
      queryKey: queryKeys.workEntries.list({ year, month, page: 0, size: 100 }),
      queryFn: () => getWorkEntries({ year, month, page: 0, size: 100 })
    }))
  });
  const markedDates = useMemo(() => {
    const dates = new Set<string>();
    entryQueries.forEach((query) => {
      query.data?.content.forEach((entry) => dates.add(entry.workDate));
    });
    return dates;
  }, [entryQueries]);
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
          <h2 className="text-[1rem] font-medium tracking-[-0.03em] text-white/68">
            {monthLabel}
          </h2>
        </div>
      </div>
      <div className="relative min-h-[84px] touch-pan-y overflow-hidden">
        <AnimatePresence custom={slideDirection} initial={false} mode="wait">
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
                x: direction === 0 ? 0 : direction > 0 ? 36 : -36,
                opacity: 0
              }),
              center: {
                x: 0,
                opacity: 1
              },
              exit: (direction: number) => ({
                x: direction > 0 ? -36 : 36,
                opacity: 0
              })
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="grid grid-cols-7 gap-1"
          >
            {days.map((day, index) => {
              const selected = isSameDay(day.date, value);
              const current = !selected && isSameDay(day.date, today);
              const hasEntries = markedDates.has(formatLocalIsoDate(day.date));
              const state = selected ? "selected" : current ? "today" : "default";

              return (
                <motion.button
                  key={day.key}
                  type="button"
                  aria-pressed={selected}
                  aria-label={`${day.weekday} ${day.dayNumber}`}
                  data-state={state}
                  initial={{ opacity: 0.94, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.02 }}
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
                          ? "border border-white/[0.08] bg-white/[0.1] text-white/88"
                          : "text-white/76"
                    )}
                  >
                    {day.dayNumber}
                  </motion.div>
                  <span
                    className={cn(
                      "block h-1.5 w-1.5 rounded-full transition",
                      hasEntries
                        ? selected
                          ? "bg-black/68"
                          : current
                            ? "bg-white/72"
                            : "bg-white/46"
                        : "bg-transparent"
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

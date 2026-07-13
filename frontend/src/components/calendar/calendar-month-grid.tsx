import { AnimatePresence, motion } from "framer-motion";
import { cn } from "../../utils/cn";
import { getCalendarWeekdays, formatAriaDate, type CalendarDayCell } from "../../features/calendar/calendar-utils";

type DayMeta = {
  entriesCount: number;
  hasAbsence: boolean;
};

type Props = {
  monthKey: string;
  slideDirection: number;
  days: CalendarDayCell[];
  selectedDate: Date;
  today: Date;
  getDayMeta: (isoDate: string) => DayMeta;
  onSelect: (date: Date) => void;
  onSwipeChange: (direction: -1 | 1) => void;
  onResolveSwipe: (info: { offset: { x: number; y: number }; velocity: { x: number; y: number } }) => number;
};

const weekdays = getCalendarWeekdays();

export function CalendarMonthGrid({
  monthKey,
  slideDirection,
  days,
  selectedDate,
  today,
  getDayMeta,
  onSelect,
  onSwipeChange,
  onResolveSwipe
}: Props) {
  return (
    <section className="space-y-5" aria-label="Monthly calendar">
      <div className="grid grid-cols-7 gap-x-3 gap-y-2" role="row">
        {weekdays.map((weekday) => (
          <div
            key={weekday}
            className="text-center text-[10px] font-medium tracking-[0.24em] text-white/36"
          >
            {weekday}
          </div>
        ))}
      </div>

      <div className="relative overflow-hidden touch-pan-y">
        <AnimatePresence custom={slideDirection} initial={false} mode="wait">
          <motion.div
            key={monthKey}
            custom={slideDirection}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.08}
            dragDirectionLock
            onDragEnd={(_, info) => {
              const direction = onResolveSwipe(info);
              if (direction === -1) {
                onSwipeChange(-1);
              } else if (direction === 1) {
                onSwipeChange(1);
              }
            }}
            variants={{
              enter: (direction: number) => ({
                x: direction === 0 ? 0 : direction > 0 ? 38 : -38,
                opacity: 0
              }),
              center: { x: 0, opacity: 1 },
              exit: (direction: number) => ({
                x: direction > 0 ? -38 : 38,
                opacity: 0
              })
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="grid grid-cols-7 gap-x-3 gap-y-3"
            role="grid"
          >
            {days.map((day) => {
              const selected =
                day.date.getFullYear() === selectedDate.getFullYear() &&
                day.date.getMonth() === selectedDate.getMonth() &&
                day.date.getDate() === selectedDate.getDate();
              const current =
                !selected &&
                day.date.getFullYear() === today.getFullYear() &&
                day.date.getMonth() === today.getMonth() &&
                day.date.getDate() === today.getDate();
              const meta = getDayMeta(day.key);
              const ariaSegments = [formatAriaDate(day.date)];
              if (selected) {
                ariaSegments.push("selected");
              }
              if (current) {
                ariaSegments.push("today");
              }
              if (meta.entriesCount > 0) {
                ariaSegments.push(
                  `${meta.entriesCount} work entr${meta.entriesCount === 1 ? "y" : "ies"}`
                );
              }
              if (meta.hasAbsence) {
                ariaSegments.push("absence");
              }

              return (
                <button
                  key={day.key}
                  type="button"
                  role="gridcell"
                  aria-selected={selected}
                  aria-label={ariaSegments.join(", ")}
                  data-state={selected ? "selected" : current ? "today" : "default"}
                  onClick={() => onSelect(day.date)}
                  className={cn(
                    "flex min-h-[88px] flex-col items-center justify-start gap-2 rounded-[24px] px-1 py-1 text-center transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white/24 focus:ring-offset-2 focus:ring-offset-[#050505]",
                    !day.inActiveMonth && "text-white/22"
                  )}
                >
                  <span className="sr-only">{day.weekday}</span>
                  <div
                    className={cn(
                      "flex h-[52px] w-[52px] items-center justify-center rounded-full text-[18px] font-medium tracking-[-0.04em] transition",
                      selected
                        ? "bg-white text-black shadow-[0_18px_38px_rgba(255,255,255,0.16)]"
                        : current
                          ? "border border-white/[0.06] bg-white/[0.08] text-white/78"
                          : day.inActiveMonth
                            ? "text-white/82"
                            : "text-white/26"
                    )}
                  >
                    {day.dayNumber}
                  </div>

                  <div className="flex min-h-[10px] items-center gap-1" aria-hidden="true">
                    {meta.hasAbsence ? (
                      <span className="h-1.5 w-1.5 rounded-full border border-white/40" />
                    ) : null}
                    {!meta.hasAbsence && meta.entriesCount > 0 ? (
                      meta.entriesCount <= 3 ? (
                        Array.from({ length: meta.entriesCount }, (_, index) => (
                          <span key={index} className="h-1.5 w-1.5 rounded-full bg-white/52" />
                        ))
                      ) : (
                        <span className="text-[10px] font-semibold text-white/40">
                          {meta.entriesCount}
                        </span>
                      )
                    ) : null}
                  </div>
                </button>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}

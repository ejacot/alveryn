import { AnimatePresence, motion } from "framer-motion";
import { cn } from "../../utils/cn";
import { getCalendarWeekdays, formatAriaDate, type CalendarDayCell } from "../../features/calendar/calendar-utils";

type DayMeta = {
  entriesCount: number;
  hasAbsence: boolean;
};

type Props = {
  monthLabel: string;
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
  monthLabel,
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
  const rowCount = days.length / 7;
  const gridClassName =
    rowCount === 4
      ? "grid grid-cols-7 gap-x-2.5 gap-y-1 sm:gap-x-3 sm:gap-y-1.5"
      : rowCount === 5
        ? "grid grid-cols-7 gap-x-2.5 gap-y-1 sm:gap-x-3 sm:gap-y-2"
        : "grid grid-cols-7 gap-x-2.5 gap-y-1.5 sm:gap-x-3 sm:gap-y-2.5";
  const cellClassName =
    rowCount === 4
      ? "flex min-h-[29px] flex-col items-center justify-start gap-0 rounded-[16px] px-0.5 py-0.5 text-center transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white/18 focus:ring-offset-2 focus:ring-offset-[#050505] sm:min-h-[33px]"
      : rowCount === 5
        ? "flex min-h-[31px] flex-col items-center justify-start gap-0 rounded-[16px] px-0.5 py-0.5 text-center transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white/18 focus:ring-offset-2 focus:ring-offset-[#050505] sm:min-h-[35px]"
        : "flex min-h-[34px] flex-col items-center justify-start gap-0 rounded-[16px] px-0.5 py-0.5 text-center transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white/18 focus:ring-offset-2 focus:ring-offset-[#050505] sm:min-h-[38px]";

  return (
    <section className="mx-auto w-full max-w-[28rem] space-y-2.5 overflow-hidden sm:max-w-[32rem]" aria-label="Monthly calendar">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-[1rem] font-medium tracking-[-0.03em] text-white/68">
          {monthLabel}
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1" role="row">
        {weekdays.map((weekday) => (
          <div
            key={weekday}
            className="text-center text-[10px] font-semibold tracking-[0.2em] text-white/34"
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
            className={gridClassName}
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
                    `${cellClassName} justify-between`,
                    !day.inActiveMonth && "text-white/20"
                  )}
                >
                  <span className="sr-only">{day.weekday}</span>
                  <div
                    className={cn(
                      "relative flex h-9 w-9 items-center justify-center rounded-full text-[14px] font-semibold transition sm:h-10 sm:w-10",
                      selected
                        ? "scale-[1.035] bg-white text-black shadow-[0_22px_44px_rgba(255,255,255,0.14)]"
                        : current
                          ? "border border-white/[0.08] bg-white/[0.1] text-white/88"
                          : day.inActiveMonth
                            ? "text-white/76"
                            : "text-white/28"
                    )}
                  >
                    {day.dayNumber}
                  </div>

                  <div className="flex min-h-[4px] items-center gap-1" aria-hidden="true">
                    {meta.hasAbsence ? (
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full border",
                          day.inActiveMonth ? "border-white/42" : "border-white/18"
                        )}
                      />
                    ) : null}
                    {!meta.hasAbsence && meta.entriesCount > 0 ? (
                      meta.entriesCount <= 3 ? (
                        Array.from({ length: meta.entriesCount }, (_, index) => (
                          <span
                            key={index}
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              day.inActiveMonth ? "bg-white/56" : "bg-white/18"
                            )}
                          />
                        ))
                      ) : (
                        <span
                          className={cn(
                            "text-[10px] font-semibold",
                            day.inActiveMonth ? "text-white/42" : "text-white/18"
                          )}
                        >
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

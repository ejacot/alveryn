import { AnimatePresence, motion } from "framer-motion";
import { cn } from "../../utils/cn";
import { getCalendarWeekdays, formatAriaDate, type CalendarDayCell } from "../../features/calendar/calendar-utils";
import type { AbsenceTypeSetting } from "../../types/absence";
type DayMeta = {
  entriesCount: number;
  marker: { label: string; color: string } | null;
  noActivityInTrackedRange: boolean;
};

type Props = {
  monthLabel: string;
  monthKey: string;
  slideDirection: number;
  days: CalendarDayCell[];
  selectedDate: Date | null;
  today: Date;
  absenceTypes: AbsenceTypeSetting[];
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
  absenceTypes,
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
          <h2 className="hairline-text">
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
            {weekday.slice(0, 3)}
          </div>
        ))}
      </div>

      <div className="relative overflow-hidden touch-pan-y">
        <div className={`${gridClassName} invisible pointer-events-none`} aria-hidden="true">
          {days.map((day) => (
            <div
              key={`placeholder-${day.key}`}
              className={cn(`${cellClassName} justify-between`)}
            >
              <div className="h-9 w-9 sm:h-10 sm:w-10" />
              <div className="min-h-[4px]" />
            </div>
          ))}
        </div>
        <AnimatePresence custom={slideDirection} initial={false}>
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
                x: direction === 0 ? 0 : direction > 0 ? "100%" : "-100%"
              }),
              center: { x: 0 },
              exit: (direction: number) => ({
                x: direction > 0 ? "-100%" : "100%"
              })
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            className={`absolute inset-x-0 top-0 ${gridClassName}`}
            role="grid"
          >
            {days.map((day) => {
              const selected =
                selectedDate !== null &&
                day.date.getFullYear() === selectedDate.getFullYear() &&
                day.date.getMonth() === selectedDate.getMonth() &&
                day.date.getDate() === selectedDate.getDate();
              const current =
                !selected &&
                day.date.getFullYear() === today.getFullYear() &&
                day.date.getMonth() === today.getMonth() &&
                day.date.getDate() === today.getDate();
              const meta = getDayMeta(day.key);
              const shouldHighlightNoActivity = meta.noActivityInTrackedRange && !selected;
              const ariaSegments = [formatAriaDate(day.date)];
              if (selected) {
                ariaSegments.push("selected");
              }
              if (current) {
                ariaSegments.push("today");
              }
              if (meta.entriesCount > 0) {
                ariaSegments.push(`${meta.entriesCount} work record${meta.entriesCount === 1 ? "" : "s"}`);
              }
              if (meta.marker) {
                ariaSegments.push(meta.marker.label);
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
                          ? cn(
                              "border border-white/[0.08] bg-white/[0.1]",
                              shouldHighlightNoActivity ? "text-red-300" : "text-white/88"
                            )
                          : day.inActiveMonth
                            ? shouldHighlightNoActivity ? "text-red-300" : "text-white/76"
                            : shouldHighlightNoActivity ? "text-red-300" : "text-white/28"
                    )}
                  >
                    {day.dayNumber}
                  </div>

                  <div className="flex min-h-[4px] items-center gap-1" aria-hidden="true">
                    {meta.marker ? (
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{
                          backgroundColor: meta.marker.color,
                          opacity: day.inActiveMonth ? 1 : 0.45
                        }}
                      />
                    ) : null}
                  </div>
                </button>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>

      {absenceTypes.length > 0 ? (
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 pt-1 text-[10px] font-medium tracking-[0.14em] text-white/34">
          {absenceTypes.map((absenceType) => (
            <LegendDot
              key={absenceType.id}
              color={absenceType.color}
              label={absenceType.name}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../../utils/cn";
import {
  formatAriaDate,
  getCalendarWeekdays,
  type CalendarDayCell
} from "../../features/calendar/calendar-utils";
import type { AbsenceTypeSetting } from "../../types/absence";

type DayMeta = {
  entriesCount: number;
  marker: { label: string; color: string } | null;
  noActivityInTrackedRange: boolean;
  activityLabel?: string | null;
  earningsLabel?: string | null;
  intensity?: number;
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
  onResolveSwipe: (info: {
    offset: { x: number; y: number };
    velocity: { x: number; y: number };
  }) => number;
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
  const { t } = useTranslation("calendar");
  const rowCount = days.length / 7;
  const gridClassName =
    rowCount === 6
      ? "grid grid-cols-7 gap-x-1 gap-y-1 sm:gap-x-2 sm:gap-y-1.5"
      : "grid grid-cols-7 gap-x-1 gap-y-1.5 sm:gap-x-2 sm:gap-y-2";
  const cellClassName =
    rowCount === 6
      ? "flex min-h-[49px] flex-col items-center justify-between rounded-[13px] px-0.5 py-0.5 text-center transition duration-200 focus:outline-none focus:ring-2 focus:ring-[#d5be8d]/30 sm:min-h-[54px]"
      : "flex min-h-[54px] flex-col items-center justify-between rounded-[14px] px-0.5 py-1 text-center transition duration-200 focus:outline-none focus:ring-2 focus:ring-[#d5be8d]/30 sm:min-h-[59px]";

  return (
    <section
      className="mx-auto w-full overflow-hidden px-1 pb-1"
      aria-label={t("calendarGrid.label")}
    >
      <div className="flex min-h-12 items-center justify-between">
        <MonthButton label={t("calendarGrid.previousMonth")} onClick={() => onSwipeChange(-1)}>
          <ChevronLeft className="h-5 w-5" />
        </MonthButton>
        <div className="text-center">
          <p className="text-[1.25rem] font-semibold tracking-[-0.045em] text-[#f4f0e7]">
            {monthLabel}
          </p>
          <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.24em] text-[#d5be8d]/58">
            {t("calendarGrid.monthlyActivity")}
          </p>
        </div>
        <MonthButton label={t("calendarGrid.nextMonth")} onClick={() => onSwipeChange(1)}>
          <ChevronRight className="h-5 w-5" />
        </MonthButton>
      </div>

      <div className="mt-2 grid grid-cols-7 gap-1 border-t border-white/[0.065] pt-3" role="row">
        {weekdays.map((weekday) => (
          <div
            key={weekday}
            className="text-center text-[9px] font-semibold tracking-[0.17em] text-white/32"
          >
            {weekday.slice(0, 3)}
          </div>
        ))}
      </div>

      <div className="relative mt-2 overflow-hidden touch-pan-y">
        <div className={`${gridClassName} invisible pointer-events-none`} aria-hidden="true">
          {days.map((day) => (
            <div key={`placeholder-${day.key}`} className={cellClassName}>
              <div className="h-7 w-7" />
              <div className="min-h-[14px]" />
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
              if (direction === -1) onSwipeChange(-1);
              if (direction === 1) onSwipeChange(1);
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
            transition={{ duration: 0.24, ease: [0.32, 0.72, 0, 1] }}
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
              const ariaSegments = [formatAriaDate(day.date)];
              if (selected) ariaSegments.push("selected");
              if (current) ariaSegments.push("today");
              if (meta.entriesCount > 0) ariaSegments.push(`${meta.entriesCount} work records`);
              if (meta.marker) ariaSegments.push(meta.marker.label);

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
                    cellClassName,
                    selected && "bg-[#f4f0e7] shadow-[0_12px_34px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.8)]",
                    !selected && day.inActiveMonth && meta.entriesCount > 0 && "bg-[#d5be8d]/[0.035]",
                    !selected && day.inActiveMonth && "hover:bg-white/[0.055]",
                    !day.inActiveMonth && "opacity-30"
                  )}
                  style={resolveDaySurfaceStyle(meta, selected)}
                >
                  <span
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-semibold",
                      selected
                        ? "text-black"
                        : current
                          ? "border border-[#d5be8d]/35 bg-[#d5be8d]/10 text-[#f4f0e7]"
                          : meta.noActivityInTrackedRange
                            ? "text-[#d5be8d]/72"
                            : "text-white/74"
                    )}
                  >
                    {day.dayNumber}
                  </span>
                  <div className="flex min-h-[17px] max-w-full flex-col items-center justify-end leading-none">
                    {meta.activityLabel ? (
                      <>
                        <span
                          className={cn(
                            "max-w-full truncate font-metric text-[8px] font-semibold tabular-nums",
                            selected ? "text-black/64" : "text-[#ead8ac]/82"
                          )}
                        >
                          {meta.activityLabel}
                        </span>
                        {meta.earningsLabel ? (
                          <span className={cn(
                            "mt-0.5 max-w-full truncate font-metric text-[7px] font-medium tabular-nums",
                            selected ? "text-black/42" : "text-white/32"
                          )}>
                            {meta.earningsLabel}
                          </span>
                        ) : null}
                      </>
                    ) : meta.marker ? (
                      <span className="flex max-w-full items-center justify-center">
                        <span
                          className={cn(
                            "calendar-day-marker max-w-[42px] truncate text-[7px] font-semibold leading-tight",
                            selected && "text-black/52"
                          )}
                          style={!selected
                            ? {
                                color: meta.marker.color,
                                "--calendar-marker-color": meta.marker.color
                              } as CSSProperties
                            : undefined}
                        >
                          {meta.marker.label}
                        </span>
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>

      {absenceTypes.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-white/[0.06] pt-3 text-[9px] font-medium tracking-[0.12em] text-white/36">
          {absenceTypes.map((absenceType) => (
            <LegendDot key={absenceType.id} color={absenceType.color} label={absenceType.name} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function resolveDaySurfaceStyle(meta: DayMeta, selected: boolean) {
  if (selected) return undefined;

  if (meta.entriesCount > 0) {
    const opacity = 0.18 + Math.min(meta.intensity ?? 0, 1) * 0.52;
    return {
      boxShadow: `inset 0 -2px 0 rgba(213,190,141,${opacity})`
    };
  }

  if (meta.marker) {
    return {
      boxShadow: `inset 0 -2px 0 color-mix(in srgb, ${meta.marker.color} 68%, transparent)`,
      backgroundColor: `color-mix(in srgb, ${meta.marker.color} 7%, transparent)`
    };
  }

  return undefined;
}

function MonthButton({
  label,
  onClick,
  children
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid h-10 w-10 place-items-center rounded-full text-white/62 transition hover:bg-white/[0.07] hover:text-white active:scale-95"
      aria-label={label}
    >
      {children}
    </button>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      <span>{label}</span>
    </span>
  );
}

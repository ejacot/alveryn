import type { PanInfo } from "framer-motion";
import { formatLocalIsoDate, parseLocalIsoDate } from "../../utils/date";

const weekdayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short"
});

const monthFormatter = new Intl.DateTimeFormat(undefined, {
  month: "long",
  year: "numeric"
});

const longDateFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  day: "numeric",
  month: "long"
});

const fullDateFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric"
});

const MONTH_SWIPE_DISTANCE_THRESHOLD = 84;
const MONTH_SWIPE_VELOCITY_THRESHOLD = 460;

export type CalendarDayCell = {
  key: string;
  date: Date;
  dayNumber: number;
  weekday: string;
  inActiveMonth: boolean;
};

export function startOfMonth(date: Date) {
  const result = new Date(date.getFullYear(), date.getMonth(), 1);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function addDays(date: Date, amount: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

export function addMonths(date: Date, amount: number) {
  const result = new Date(date.getFullYear(), date.getMonth() + amount, 1);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function startOfWeekMonday(date: Date) {
  const result = new Date(date);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function isSameMonth(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();
}

export function toIsoDate(date: Date) {
  return formatLocalIsoDate(date);
}

export function parseIsoDate(value: string) {
  return parseLocalIsoDate(value);
}

export function getCalendarWeekdays() {
  const monday = startOfWeekMonday(new Date("2026-07-13T00:00:00"));
  return Array.from({ length: 7 }, (_, index) =>
    weekdayFormatter.format(addDays(monday, index)).slice(0, 3).toUpperCase()
  );
}

export function buildMonthGrid(month: Date): CalendarDayCell[] {
  const activeMonth = startOfMonth(month);
  const gridStart = startOfWeekMonday(activeMonth);

  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(gridStart, index);
    return {
      key: toIsoDate(date),
      date,
      dayNumber: date.getDate(),
      weekday: weekdayFormatter.format(date).slice(0, 3).toUpperCase(),
      inActiveMonth: isSameMonth(date, activeMonth)
    };
  });
}

export function formatMonthLabel(date: Date) {
  return monthFormatter.format(date);
}

export function formatSelectedDate(date: Date) {
  return longDateFormatter.format(date);
}

export function formatAriaDate(date: Date) {
  return fullDateFormatter.format(date);
}

export function absenceOverlapsDate(
  absence: { startDate: string; endDate: string },
  date: Date
) {
  const iso = toIsoDate(date);
  return absence.startDate <= iso && absence.endDate >= iso;
}

export function countMonthOverlapDays(
  absence: { startDate: string; endDate: string },
  month: Date
) {
  const monthStart = toIsoDate(startOfMonth(month));
  const monthEnd = toIsoDate(addDays(addMonths(startOfMonth(month), 1), -1));
  const overlapStart = absence.startDate > monthStart ? absence.startDate : monthStart;
  const overlapEnd = absence.endDate < monthEnd ? absence.endDate : monthEnd;

  if (overlapStart > overlapEnd) {
    return 0;
  }

  const start = parseIsoDate(overlapStart);
  const end = parseIsoDate(overlapEnd);
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

export function getNextMonthDate(date: Date) {
  return addMonths(date, 1);
}

export function getPreviousMonthDate(date: Date) {
  return addMonths(date, -1);
}

export function resolveMonthSwipeDirection(info: Pick<PanInfo, "offset" | "velocity">) {
  const offsetX = info.offset.x;
  const offsetY = info.offset.y;

  if (Math.abs(offsetY) > Math.abs(offsetX)) {
    return 0;
  }

  if (
    offsetX >= MONTH_SWIPE_DISTANCE_THRESHOLD ||
    info.velocity.x >= MONTH_SWIPE_VELOCITY_THRESHOLD
  ) {
    return -1;
  }

  if (
    offsetX <= -MONTH_SWIPE_DISTANCE_THRESHOLD ||
    info.velocity.x <= -MONTH_SWIPE_VELOCITY_THRESHOLD
  ) {
    return 1;
  }

  return 0;
}

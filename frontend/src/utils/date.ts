const weekdayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short"
});

export function formatLocalIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseLocalIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function todayLocalIsoDate() {
  return formatLocalIsoDate(new Date());
}

export function startOfWeek(date: Date) {
  const result = new Date(date);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function addDays(date: Date, amount: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

export function addWeeks(date: Date, amount: number) {
  return addDays(date, amount * 7);
}

export function eachDayOfInterval(start: Date, end: Date) {
  const days: Date[] = [];
  let current = parseLocalIsoDate(formatLocalIsoDate(start));
  const last = formatLocalIsoDate(end);

  while (formatLocalIsoDate(current) <= last) {
    days.push(current);
    current = addDays(current, 1);
  }

  return days;
}

export function daysBetweenInclusive(start: Date, end: Date) {
  return eachDayOfInterval(start, end).length;
}

export function getWeekDays(anchor = new Date()) {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(start, index);
    return {
      key: formatLocalIsoDate(date),
      date,
      weekday: weekdayFormatter.format(date).toUpperCase(),
      dayNumber: date.getDate()
    };
  });
}

export function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

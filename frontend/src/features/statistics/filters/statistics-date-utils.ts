const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseLocalDate(value: string) {
  const match = ISO_DATE.exec(value);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

export function formatLocalDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function addDays(date: Date, days: number) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

export function addYearsClamped(date: Date, years: number) {
  const targetYear = date.getFullYear() + years;
  const targetMonth = date.getMonth();
  const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
  return new Date(targetYear, targetMonth, Math.min(date.getDate(), lastDay));
}

export function startOfWeekMonday(date: Date) {
  const day = date.getDay() || 7;
  return addDays(date, 1 - day);
}

export function daysBetweenInclusive(from: string, to: string) {
  const start = parseLocalDate(from);
  const end = parseLocalDate(to);
  if (!start || !end || end < start) {
    return 0;
  }
  let days = 1;
  for (let cursor = start; formatLocalDate(cursor) !== formatLocalDate(end); cursor = addDays(cursor, 1)) {
    days += 1;
  }
  return days;
}

export function previousEqualRange(from: string, to: string) {
  const start = parseLocalDate(from);
  const days = daysBetweenInclusive(from, to);
  if (!start || days <= 0) {
    return { from, to };
  }
  const previousTo = addDays(start, -1);
  const previousFrom = addDays(previousTo, -(days - 1));
  return { from: formatLocalDate(previousFrom), to: formatLocalDate(previousTo) };
}

export function currentWeekElapsedRange(now = new Date()) {
  const start = startOfWeekMonday(now);
  const elapsed = daysBetweenInclusive(formatLocalDate(start), formatLocalDate(now));
  const previousStart = addDays(start, -7);
  return {
    periodA: { from: formatLocalDate(start), to: formatLocalDate(now) },
    periodB: { from: formatLocalDate(previousStart), to: formatLocalDate(addDays(previousStart, elapsed - 1)) }
  };
}

export function monthRange(now = new Date(), offset = 0) {
  const monthStart = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return {
    from: formatLocalDate(monthStart),
    to: formatLocalDate(new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0))
  };
}

export function yearRange(now = new Date(), offset = 0) {
  const year = now.getFullYear() + offset;
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

export function ytdRange(now = new Date(), offset = 0) {
  const targetToday = addYearsClamped(now, offset);
  return { from: `${targetToday.getFullYear()}-01-01`, to: formatLocalDate(targetToday) };
}

export function firstHalfRange(now = new Date(), offset = 0) {
  const year = now.getFullYear() + offset;
  return { from: `${year}-01-01`, to: `${year}-06-30` };
}

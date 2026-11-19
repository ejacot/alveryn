export function planToday(timezone: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

export function addPlanDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function planWeekStart(date: string) {
  return addPlanDays(date, -((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7));
}

export function planSelectedDay(search: URLSearchParams, from: string, to: string, timezone: string) {
  const day = search.get("day");
  if (day && /^\d{4}-\d{2}-\d{2}$/.test(day) && day >= from && day <= to) return day;
  const today = planToday(timezone);
  return today >= from && today <= to ? today : from;
}

export function planContextSearch(unit: string, week: string, day?: string, requirement?: string, assignment?: string) {
  const search = new URLSearchParams({ unit, week });
  if (day) search.set("day", day);
  if (requirement) search.set("requirement", requirement);
  if (assignment) search.set("assignment", assignment);
  return `?${search.toString()}`;
}

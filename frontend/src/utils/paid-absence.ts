import type { Absence, AbsenceType } from "../types/absence";
import type { HourlyRatePeriod, UserPreferences } from "../types/configuration";
import type { WorkEntry } from "../types/work-entry";
import { eachDayOfInterval, formatLocalIsoDate, parseLocalIsoDate } from "./date";

export type PaidAbsenceDay = {
  date: string;
  minutes: number;
  grossAmount: number;
  currency: string;
};

export function isPaidAbsenceType(absenceType: AbsenceType, preferences: UserPreferences | null | undefined) {
  if (absenceType === "SICK_LEAVE") {
    return preferences?.paidSickLeave ?? true;
  }
  if (absenceType === "VACATION") {
    return preferences?.paidVacation ?? true;
  }
  return false;
}

export function calculatePaidAbsenceDays({
  absences,
  entries,
  hourlyRates,
  preferences,
  from,
  to
}: {
  absences: Absence[];
  entries: WorkEntry[];
  hourlyRates: HourlyRatePeriod[];
  preferences: UserPreferences | null | undefined;
  from: string;
  to: string;
}) {
  const paidMinutes = preferences?.preferredDailyMinutes ?? 480;
  if (paidMinutes <= 0) {
    return [];
  }

  const entryDates = new Set(entries.map((entry) => entry.workDate));
  const result: PaidAbsenceDay[] = [];

  absences.forEach((absence) => {
    if (!isPaidAbsenceType(absence.absenceType, preferences)) {
      return;
    }

    const rangeStart = absence.startDate > from ? absence.startDate : from;
    const rangeEnd = absence.endDate < to ? absence.endDate : to;
    if (rangeStart > rangeEnd) {
      return;
    }

    eachDayOfInterval(parseLocalIsoDate(rangeStart), parseLocalIsoDate(rangeEnd)).forEach((date) => {
      const dateKey = formatLocalIsoDate(date);
      if (entryDates.has(dateKey)) {
        return;
      }

      const rate = findHourlyRateForDate(hourlyRates, dateKey);
      if (!rate) {
        return;
      }

      result.push({
        date: dateKey,
        minutes: paidMinutes,
        grossAmount: (paidMinutes / 60) * Number(rate.hourlyRate),
        currency: rate.currency
      });
    });
  });

  return result;
}

function findHourlyRateForDate(rates: HourlyRatePeriod[], date: string) {
  return rates.find((rate) => rate.validFrom <= date && (!rate.validTo || rate.validTo >= date)) ?? null;
}

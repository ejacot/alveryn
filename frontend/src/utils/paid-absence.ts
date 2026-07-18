import type { Absence } from "../types/absence";
import type { HourlyRatePeriod, UserPreferences } from "../types/configuration";
import { eachDayOfInterval, formatLocalIsoDate, parseLocalIsoDate } from "./date";

export type PaidAbsenceDay = {
  date: string;
  minutes: number;
  grossAmount: number;
  currency: string;
};

export function isPaidAbsence(absence: Absence, preferences: UserPreferences | null | undefined) {
  if (typeof absence.paid === "boolean") {
    return absence.paid;
  }
  return Boolean(preferences);
}

export function calculatePaidAbsenceDays({
  absences,
  activityDates = [],
  hourlyRates,
  preferences,
  from,
  to
}: {
  absences: Absence[];
  activityDates?: string[];
  hourlyRates: HourlyRatePeriod[];
  preferences: UserPreferences | null | undefined;
  from: string;
  to: string;
}) {
  const entryDates = new Set(activityDates);
  const result: PaidAbsenceDay[] = [];

  absences.forEach((absence) => {
    if (!isPaidAbsence(absence, preferences)) {
      return;
    }
    const paidMinutes = absence.paidMinutesPerDay ?? preferences?.preferredDailyMinutes ?? 480;
    if (paidMinutes <= 0) {
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

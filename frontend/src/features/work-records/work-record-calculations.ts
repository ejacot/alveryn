import type { HourlyRatePeriod } from "../../types/configuration";

export type WorkRecordTimeCalculationInput = {
  startTime: string;
  endTime: string;
  breakMinutes: number;
};

export function calculateWorkRecordTimeMinutes({
  startTime,
  endTime,
  breakMinutes
}: WorkRecordTimeCalculationInput) {
  if (!startTime || !endTime) {
    return null;
  }

  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);

  if (startMinutes == null || endMinutes == null || breakMinutes < 0) {
    return null;
  }

  const totalIntervalMinutes =
    endMinutes > startMinutes
      ? endMinutes - startMinutes
      : 24 * 60 - startMinutes + endMinutes;

  if (breakMinutes >= totalIntervalMinutes) {
    return null;
  }

  return {
    totalIntervalMinutes,
    workedMinutes: totalIntervalMinutes - breakMinutes
  };
}

export function findApplicableHourlyRate(
  rates: HourlyRatePeriod[],
  workDate: string
): HourlyRatePeriod | null {
  const eligible = rates
    .filter((rate) => {
      if (rate.validFrom > workDate) {
        return false;
      }
      if (rate.validTo && rate.validTo < workDate) {
        return false;
      }
      return true;
    })
    .sort((left, right) => right.validFrom.localeCompare(left.validFrom));

  return eligible[0] ?? null;
}

export function calculateGrossAmount(workedMinutes: number, hourlyRate: string | number) {
  const numericRate = Number(hourlyRate);

  if (!Number.isFinite(numericRate) || workedMinutes <= 0) {
    return 0;
  }

  return (workedMinutes / 60) * numericRate;
}

export function parseTimeToMinutes(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return hours * 60 + minutes;
}

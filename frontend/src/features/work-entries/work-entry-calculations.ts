import type { HourlyRatePeriod, UnitType, WorkType } from "../../types/configuration";

export type TimeCalculationInput = {
  startTime: string;
  endTime: string;
  breakMinutes: number;
};

export type UnitRowCalculationInput = {
  unitTypeId: string;
  quantity: number;
};

export function calculateTimeEntryMinutes({
  startTime,
  endTime,
  breakMinutes
}: TimeCalculationInput) {
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

export function calculateUnitEntryMinutes(
  rows: UnitRowCalculationInput[],
  unitTypes: UnitType[]
) {
  if (!rows.length) {
    return null;
  }

  let totalMinutes = 0;
  let hasAny = false;

  for (const row of rows) {
    if (!row.unitTypeId || Number.isNaN(row.quantity) || row.quantity <= 0) {
      continue;
    }

    const unitType = unitTypes.find((item) => item.id === row.unitTypeId);
    if (!unitType) {
      continue;
    }

    const unitsPerHour = Number(unitType.unitsPerHour);
    if (!Number.isFinite(unitsPerHour) || unitsPerHour <= 0) {
      continue;
    }

    totalMinutes += (row.quantity * 60) / unitsPerHour;
    hasAny = true;
  }

  return hasAny ? totalMinutes : null;
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

export function workTypeIsUnitBased(workType?: WorkType | null) {
  return workType?.calculationMethod === "UNIT_BASED";
}

export function workTypeIsTimeBased(workType?: WorkType | null) {
  return workType?.calculationMethod === "TIME_BASED";
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

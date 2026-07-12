export type CalculationMethod = "TIME_BASED" | "UNIT_BASED";

export type TimeEntryDetails = {
  startTime: string;
  endTime: string;
  breakMinutes: number;
  totalIntervalMinutes: number;
  workedMinutes: number;
};

export type UnitEntryItem = {
  id: string;
  unitTypeId: string;
  unitName: string;
  quantity: string;
  unitsPerHourSnapshot: string;
  calculatedMinutes: string;
};

export type WorkEntry = {
  id: string;
  workTypeId: string;
  workTypeName: string;
  calculationMethod: CalculationMethod;
  workDate: string;
  hourlyRateSnapshot: string;
  currencySnapshot: string;
  calculatedMinutes: string;
  workedHours: string;
  grossAmount: string;
  notes: string | null;
  timeEntry: TimeEntryDetails | null;
  unitItems: UnitEntryItem[];
  createdAt: string;
  updatedAt: string;
};

export type WorkEntryRequest = {
  workTypeId: string;
  workDate: string;
  startTime?: string | null;
  endTime?: string | null;
  unpaidBreakMinutes?: number | null;
  unitItems?: {
    unitTypeId: string;
    quantity: number;
  }[];
  notes?: string | null;
};

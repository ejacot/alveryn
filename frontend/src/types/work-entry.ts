export type CalculationMethod = "TIME_BASED" | "UNIT_BASED";
export type CompensationMethod = "HOURLY" | "PER_UNIT";

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
  unitSymbol?: string | null;
  quantity: string;
  displayOrder?: number | null;
  unitsPerHourSnapshot?: string | null;
  calculatedMinutes: string;
  ratePerUnitSnapshot?: string | null;
  currencySnapshot?: string | null;
  grossAmountSnapshot?: string | null;
};

export type WorkEntry = {
  id: string;
  workTypeId: string;
  workTypeName: string;
  calculationMethod: CalculationMethod;
  compensationMethod?: CompensationMethod;
  workDate: string;
  hourlyRateSnapshot: string;
  currencySnapshot: string;
  calculatedMinutes: string;
  workedHours: string;
  grossAmount: string;
  extraPayPercentage?: number | null;
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
  extraPayPercentage?: number | null;
  unitItems?: {
    unitTypeId: string;
    quantity: number;
  }[];
  notes?: string | null;
};

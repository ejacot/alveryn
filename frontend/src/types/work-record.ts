import type { WorkTypeFormulaMode } from "./configuration";
import type { Address } from "./address";

export type WorkRecordLineRequest = {
  workTypeId?: string | null;
  quantity?: number | null;
  fixedAmount?: number | null;
  currency?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  durationMinutes?: number | null;
  unpaidBreakMinutes?: number | null;
  extraPayPercentage?: number | null;
  notes?: string | null;
};

export type WorkRecordRequest = {
  workDate: string;
  workEndDate?: string | null;
  addressId?: string | null;
  teamSize?: number | null;
  notes?: string | null;
  lines: WorkRecordLineRequest[];
};

export type WorkRecordLine = {
  id: string;
  workTypeId: string;
  displayOrder: number;
  workTypeName: string;
  configurationName: string;
  calculationMode: WorkTypeFormulaMode;
  unitLabel?: string | null;
  unitSymbol?: string | null;
  quantity?: string | null;
  fixedAmountSnapshot?: string | null;
  unitsPerHourSnapshot?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  durationMinutes?: number | null;
  breakMinutes?: number | null;
  calculatedMinutes: string;
  workedHours: string;
  workedMinutes?: string;
  extraPaidEquivalentMinutes?: string;
  totalPaidEquivalentMinutes?: string;
  hourlyRateSnapshot?: string | null;
  ratePerUnitSnapshot?: string | null;
  currencySnapshot: string;
  grossAmount: string;
  baseGrossAmount?: string;
  extraGrossAmount?: string;
  totalGrossAmount?: string;
  extraPayPercentage: number;
  notes?: string | null;
};

export type WorkRecord = {
  id: string;
  entryKind?: "WORK_SESSION" | "WORK_RECORD";
  employmentId?: string | null;
  projectId?: string | null;
  projectTitle?: string | null;
  workDate: string;
  workEndDate?: string | null;
  addressId?: string | null;
  address?: Address | null;
  teamSize?: number | null;
  notes?: string | null;
  calculatedMinutes: string;
  workedHours: string;
  workedMinutes?: string;
  extraPaidEquivalentMinutes?: string;
  totalPaidEquivalentMinutes?: string;
  grossAmount: string;
  baseGrossAmount?: string;
  extraGrossAmount?: string;
  totalGrossAmount?: string;
  currency?: string | null;
  workLines?: WorkRecordLine[];
  createdAt: string;
  updatedAt: string;
};

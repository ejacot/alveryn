import type { Address } from "./address";

export type TimeFormat = "H12" | "H24";

export type ThemePreference = "LIGHT" | "DARK" | "SYSTEM";
export type FirstDayOfWeek = "MONDAY" | "SUNDAY";
export type EmploymentType = "FULL_TIME" | "PART_TIME" | "MINI_JOB" | "FREELANCE" | "CONTRACTOR" | "OTHER";

export type UserProfile = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  dateOfBirth: string | null;
  phone: string | null;
  countryCode: string | null;
  city: string | null;
  postalCode: string | null;
  street: string | null;
  houseNumber: string | null;
  apartment: string | null;
  addressId: string | null;
  address: Address | null;
  avatarUrl: string | null;
  employmentStartDate: string | null;
  employmentEndDate: string | null;
  employmentType: EmploymentType;
};

export type UserPreferences = {
  id: string;
  language: string;
  timezone: string;
  currency: string;
  firstDayOfWeek: FirstDayOfWeek;
  dateFormat: string;
  timeFormat: TimeFormat;
  theme: ThemePreference;
  defaultBreakMinutes: number;
  preferredDailyMinutes: number | null;
  paidSickLeave: boolean;
  paidVacation: boolean;
  onboardingCompleted: boolean;
};

export type HourlyRatePeriod = {
  id: string;
  hourlyRate: string;
  currency: string;
  validFrom: string;
  validTo: string | null;
};

export type WorkType = {
  id: string;
  parentId?: string | null;
  name: string;
  calculationMethod: import("./work-calculation").CalculationMethod;
  compensationMethod?: import("./work-calculation").CompensationMethod | null;
  unitLabel?: string | null;
  unitSymbol?: string | null;
  unitsPerHour?: string | null;
  ratePerUnit?: string | null;
  currency?: string | null;
  teamworkEnabled?: boolean;
  extraPayEnabled?: boolean;
  compositeEnabled?: boolean;
  color: string;
  icon: string | null;
  defaultBreakMinutes: number | null;
  displayOrder: number;
  active: boolean;
  deletable?: boolean;
};

export type WorkTypeFormulaMode = "TIME_HOURLY" | "UNITS_PER_HOUR" | "UNITS_PER_UNIT" | "FIXED_AMOUNT";

export type WorkTypeFormula = {
  id: string;
  workTypeId: string;
  name: string;
  calculationMode: WorkTypeFormulaMode;
  unitLabel?: string | null;
  unitSymbol?: string | null;
  unitsPerHour?: string | null;
  ratePerUnit?: string | null;
  currency?: string | null;
  defaultBreakMinutes?: number | null;
  active: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
};

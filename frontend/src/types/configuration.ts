export type FirstDayOfWeek = "MONDAY" | "SUNDAY";

export type TimeFormat = "H12" | "H24";

export type ThemePreference = "LIGHT" | "DARK" | "SYSTEM";

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
  avatarUrl: string | null;
  employmentStartDate: string | null;
  employmentEndDate: string | null;
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
  name: string;
  calculationMethod: import("./work-entry").CalculationMethod;
  color: string;
  icon: string | null;
  defaultBreakMinutes: number | null;
  displayOrder: number;
  active: boolean;
};

export type UnitType = {
  id: string;
  workTypeId: string;
  name: string;
  unitsPerHour: string;
  displayOrder: number;
  active: boolean;
};

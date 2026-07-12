export type AuthUser = {
  id: string;
  email: string;
  emailVerified: boolean;
  status: "ACTIVE" | "LOCKED" | "DELETED";
  lastLoginAt: string | null;
};

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
  firstDayOfWeek: "MONDAY" | "SUNDAY";
  dateFormat: string;
  timeFormat: "H12" | "H24";
  theme: "LIGHT" | "DARK" | "SYSTEM";
  defaultBreakMinutes: number;
  preferredDailyMinutes: number | null;
  onboardingCompleted: boolean;
};

export type CurrentUser = {
  account: AuthUser;
  profile: UserProfile | null;
  preferences: UserPreferences | null;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  accessTokenExpiresIn: number;
  refreshTokenExpiresAt: string;
  user: AuthUser;
};

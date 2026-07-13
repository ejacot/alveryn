import type { ApiMessage, ApiResponse, PageResponse } from "../types/api";
import type { CurrentUser, AuthTokens, AuthUser } from "../types/auth";
import type {
  HourlyRatePeriod,
  UnitType,
  UserPreferences,
  UserProfile,
  WorkType
} from "../types/configuration";
import type { DashboardResponse } from "../types/dashboard";
import type { Absence, AbsenceType } from "../types/absence";
import type { WorkEntry, WorkEntryRequest } from "../types/work-entry";
import type { OnboardingStatus } from "../types/onboarding";
import { http } from "./http";

export type Credentials = {
  email: string;
  password: string;
};

export type ResetPasswordPayload = {
  email: string;
  code: string;
  newPassword: string;
};

export type VerifyEmailPayload = {
  email: string;
  code: string;
};

export type UpdateProfilePayload = {
  firstName: string | null;
  lastName: string | null;
  displayName?: string | null;
  dateOfBirth?: string | null;
  phone: string | null;
  countryCode?: string | null;
  city?: string | null;
  postalCode?: string | null;
  street?: string | null;
  houseNumber?: string | null;
  apartment?: string | null;
  avatarUrl?: string | null;
  employmentStartDate: string | null;
  employmentEndDate?: string | null;
};

export type UpdatePreferencesPayload = {
  language: string;
  timezone: string;
  currency: string;
  firstDayOfWeek: UserPreferences["firstDayOfWeek"];
  dateFormat: string;
  timeFormat: UserPreferences["timeFormat"];
  theme: UserPreferences["theme"];
  defaultBreakMinutes: number;
  preferredDailyMinutes: number | null;
};

export type CreateHourlyRatePayload = {
  hourlyRate: number;
  currency: string;
  validFrom: string;
  validTo?: string | null;
};

export type CreateWorkTypePayload = {
  name: string;
  calculationMethod: WorkType["calculationMethod"];
  color: string;
  icon?: string | null;
  defaultBreakMinutes?: number | null;
  displayOrder: number;
};

export type CreateUnitTypePayload = {
  name: string;
  unitsPerHour: number;
  displayOrder: number;
  active: boolean;
};

export async function register(payload: Credentials) {
  const response = await http.post<ApiResponse<AuthUser>>(
    "/api/auth/register",
    payload
  );
  return response.data.data;
}

export async function login(payload: Credentials) {
  const response = await http.post<ApiResponse<AuthTokens>>(
    "/api/auth/login",
    payload
  );
  return response.data.data;
}

export async function forgotPassword(email: string) {
  const response = await http.post<ApiResponse<ApiMessage>>(
    "/api/auth/forgot-password",
    { email }
  );
  return response.data.data;
}

export async function resetPassword(payload: ResetPasswordPayload) {
  const response = await http.post<ApiResponse<ApiMessage>>(
    "/api/auth/reset-password",
    payload
  );
  return response.data.data;
}

export async function verifyEmail(payload: VerifyEmailPayload) {
  const response = await http.post<ApiResponse<ApiMessage>>(
    "/api/auth/verify-email",
    payload
  );
  return response.data.data;
}

export async function resendVerification(email: string) {
  const response = await http.post<ApiResponse<ApiMessage>>(
    "/api/auth/resend-verification",
    { email }
  );
  return response.data.data;
}

export async function logout(refreshToken: string) {
  const response = await http.post<ApiResponse<ApiMessage>>(
    "/api/auth/logout",
    { refreshToken }
  );
  return response.data.data;
}

export async function getCurrentUser() {
  const response = await http.get<ApiResponse<CurrentUser>>("/api/me");
  return response.data.data;
}

export async function getProfile() {
  const response = await http.get<ApiResponse<UserProfile>>("/api/profile");
  return response.data.data;
}

export async function updateProfile(payload: UpdateProfilePayload) {
  const response = await http.put<ApiResponse<UserProfile>>("/api/profile", payload);
  return response.data.data;
}

export async function getPreferences() {
  const response = await http.get<ApiResponse<UserPreferences>>("/api/preferences");
  return response.data.data;
}

export async function updatePreferences(payload: UpdatePreferencesPayload) {
  const response = await http.put<ApiResponse<UserPreferences>>(
    "/api/preferences",
    payload
  );
  return response.data.data;
}

export async function getOnboardingStatus() {
  const response = await http.get<ApiResponse<OnboardingStatus>>(
    "/api/onboarding/status"
  );
  return response.data.data;
}

export async function completeOnboarding() {
  const response = await http.post<ApiResponse<OnboardingStatus>>(
    "/api/onboarding/complete"
  );
  return response.data.data;
}

export async function listHourlyRates() {
  const response = await http.get<ApiResponse<HourlyRatePeriod[]>>("/api/hourly-rates");
  return response.data.data;
}

export async function createHourlyRate(payload: CreateHourlyRatePayload) {
  const response = await http.post<ApiResponse<HourlyRatePeriod>>(
    "/api/hourly-rates",
    payload
  );
  return response.data.data;
}

export async function listWorkTypes() {
  const response = await http.get<ApiResponse<WorkType[]>>("/api/work-types");
  return response.data.data;
}

export async function createWorkType(payload: CreateWorkTypePayload) {
  const response = await http.post<ApiResponse<WorkType>>("/api/work-types", payload);
  return response.data.data;
}

export async function listUnitTypes(workTypeId: string) {
  const response = await http.get<ApiResponse<UnitType[]>>(
    `/api/work-types/${workTypeId}/unit-types`
  );
  return response.data.data;
}

export async function createUnitType(
  workTypeId: string,
  payload: CreateUnitTypePayload
) {
  const response = await http.post<ApiResponse<UnitType>>(
    `/api/work-types/${workTypeId}/unit-types`,
    payload
  );
  return response.data.data;
}

export async function getDashboard() {
  const response = await http.get<ApiResponse<DashboardResponse>>("/api/dashboard");
  return response.data.data;
}

export async function getWorkEntries(
  params?: {
    year?: number;
    month?: number;
    workTypeId?: string;
    page?: number;
    size?: number;
  }
) {
  const response =
    await http.get<ApiResponse<PageResponse<WorkEntry>>>("/api/work-entries", {
      params
    });
  return response.data.data;
}

export async function getWorkEntry(id: string) {
  const response = await http.get<ApiResponse<WorkEntry>>(`/api/work-entries/${id}`);
  return response.data.data;
}

export async function createWorkEntry(payload: WorkEntryRequest) {
  const response = await http.post<ApiResponse<WorkEntry>>("/api/work-entries", payload);
  return response.data.data;
}

export async function updateWorkEntry(id: string, payload: WorkEntryRequest) {
  const response = await http.put<ApiResponse<WorkEntry>>(
    `/api/work-entries/${id}`,
    payload
  );
  return response.data.data;
}

export async function deleteWorkEntry(id: string) {
  await http.delete(`/api/work-entries/${id}`);
}

export async function getAbsences(
  params?: {
    year?: number;
    month?: number;
    from?: string;
    to?: string;
    absenceType?: AbsenceType;
    page?: number;
    size?: number;
  }
) {
  const response = await http.get<ApiResponse<PageResponse<Absence>>>("/api/absences", {
    params
  });
  return response.data.data;
}

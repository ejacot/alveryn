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
import type { ExcelImportResult } from "../types/imports";
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

export type UpdateHourlyRatePayload = CreateHourlyRatePayload;

export type CreateWorkTypePayload = {
  name: string;
  calculationMethod: WorkType["calculationMethod"];
  color: string;
  icon?: string | null;
  defaultBreakMinutes?: number | null;
  displayOrder: number;
};

export type UpdateWorkTypePayload = CreateWorkTypePayload & {
  active: boolean;
};

export type CreateUnitTypePayload = {
  name: string;
  unitsPerHour: number;
  displayOrder: number;
  active: boolean;
};

export type UpdateUnitTypePayload = CreateUnitTypePayload;

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

export async function logout() {
  const response = await http.post<ApiResponse<ApiMessage>>("/api/auth/logout");
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

export async function getHourlyRate(id: string) {
  const response = await http.get<ApiResponse<HourlyRatePeriod>>(`/api/hourly-rates/${id}`);
  return response.data.data;
}

export async function updateHourlyRate(id: string, payload: UpdateHourlyRatePayload) {
  const response = await http.put<ApiResponse<HourlyRatePeriod>>(
    `/api/hourly-rates/${id}`,
    payload
  );
  return response.data.data;
}

export async function deleteHourlyRate(id: string) {
  await http.delete(`/api/hourly-rates/${id}`);
}

export async function listWorkTypes() {
  const response = await http.get<ApiResponse<WorkType[]>>("/api/work-types");
  return response.data.data;
}

export async function createWorkType(payload: CreateWorkTypePayload) {
  const response = await http.post<ApiResponse<WorkType>>("/api/work-types", payload);
  return response.data.data;
}

export async function getWorkType(id: string) {
  const response = await http.get<ApiResponse<WorkType>>(`/api/work-types/${id}`);
  return response.data.data;
}

export async function updateWorkType(id: string, payload: UpdateWorkTypePayload) {
  const response = await http.put<ApiResponse<WorkType>>(`/api/work-types/${id}`, payload);
  return response.data.data;
}

export async function deleteWorkType(id: string) {
  await http.delete(`/api/work-types/${id}`);
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

export async function getUnitType(workTypeId: string, unitTypeId: string) {
  const response = await http.get<ApiResponse<UnitType>>(
    `/api/work-types/${workTypeId}/unit-types/${unitTypeId}`
  );
  return response.data.data;
}

export async function updateUnitType(
  workTypeId: string,
  unitTypeId: string,
  payload: UpdateUnitTypePayload
) {
  const response = await http.put<ApiResponse<UnitType>>(
    `/api/work-types/${workTypeId}/unit-types/${unitTypeId}`,
    payload
  );
  return response.data.data;
}

export async function deleteUnitType(workTypeId: string, unitTypeId: string) {
  await http.delete(`/api/work-types/${workTypeId}/unit-types/${unitTypeId}`);
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

async function fetchAllPages<T>(
  path: string,
  params: Record<string, string | number | undefined>
) {
  const size = 100;
  const firstResponse = await http.get<ApiResponse<PageResponse<T>>>(path, {
    params: { ...params, page: 0, size }
  });
  const firstPage = firstResponse.data.data;

  if (firstPage.totalPages <= 1) {
    return firstPage.content;
  }

  const remainingPages = await Promise.all(
    Array.from({ length: firstPage.totalPages - 1 }, (_, index) =>
      http.get<ApiResponse<PageResponse<T>>>(path, {
        params: { ...params, page: index + 1, size }
      })
    )
  );

  return [
    ...firstPage.content,
    ...remainingPages.flatMap((response) => response.data.data.content)
  ];
}

export function listWorkEntriesInRange(params: {
  year?: number;
  month?: number;
  workTypeId?: string;
}) {
  return fetchAllPages<WorkEntry>("/api/work-entries", params);
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

export async function importScheduleWorkbook(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await http.post<ApiResponse<ExcelImportResult>>(
    "/api/imports/excel/schedule",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data"
      }
    }
  );
  return response.data.data;
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

export function listAbsencesInRange(params: {
  year?: number;
  month?: number;
  from?: string;
  to?: string;
  absenceType?: AbsenceType;
}) {
  return fetchAllPages<Absence>("/api/absences", params);
}

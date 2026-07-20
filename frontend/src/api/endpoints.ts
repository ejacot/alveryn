import type { ApiMessage, ApiResponse, PageResponse } from "../types/api";
import type { CurrentUser, AuthTokens, AuthUser } from "../types/auth";
import type {
  HourlyRatePeriod,
  Employment,
  UserPreferences,
  UserProfile,
  WorkType
} from "../types/configuration";
import type { DashboardResponse } from "../types/dashboard";
import type { Absence, AbsenceType, AbsenceTypeSetting } from "../types/absence";
import type { WorkRecord, WorkRecordRequest } from "../types/work-record";
import type { WorkSession, WorkSessionCheckoutPayload } from "../types/work-session";
import type { OnboardingStatus } from "../types/onboarding";
import type { Address, AddressPayload } from "../types/address";
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

export type ChangePasswordPayload = {
  currentPassword: string;
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
  addressId?: string | null;
  avatarUrl?: string | null;
  employmentStartDate: string | null;
  employmentEndDate?: string | null;
  employmentType?: UserProfile["employmentType"];
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
  paidSickLeave: boolean;
  paidVacation: boolean;
};

export type CreateHourlyRatePayload = {
  employmentId?: string;
  hourlyRate: number;
  currency: string;
  validFrom: string;
  validTo?: string | null;
};

export type UpdateHourlyRatePayload = CreateHourlyRatePayload;

export type EmploymentPayload = {
  name: string;
  employmentType: null;
  compensationType: null;
  trackingFocus: Employment["trackingFocus"];
  hourBalanceEnabled: boolean;
  termsValidFrom: string;
  startDate: string | null;
  endDate: string | null;
  fixedSalaryAmount: number | null;
  currency: string | null;
  targetMinutes: number | null;
  targetPeriod: Employment["targetPeriod"];
  hourBalanceValidityMonths: number | null;
  active: boolean;
  displayOrder: number | null;
};

export type CreateWorkTypePayload = {
  name: string;
  employmentId?: string | null;
  parentId?: string | null;
  calculationMethod: WorkType["calculationMethod"];
  compensationMethod?: WorkType["compensationMethod"] | null;
  unitLabel?: string | null;
  unitSymbol?: string | null;
  unitsPerHour?: number | null;
  ratePerUnit?: number | null;
  currency?: string | null;
  teamworkEnabled?: boolean;
  extraPayEnabled?: boolean;
  compositeEnabled?: boolean;
  color?: string | null;
  icon?: string | null;
  defaultBreakMinutes?: number | null;
  displayOrder?: number | null;
};

export type UpdateWorkTypePayload = CreateWorkTypePayload & {
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

export async function refreshSession() {
  const response = await http.post<ApiResponse<AuthTokens>>("/api/auth/refresh");
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

export async function changePassword(payload: ChangePasswordPayload) {
  const response = await http.post<ApiResponse<ApiMessage>>(
    "/api/auth/change-password",
    payload
  );
  return response.data.data;
}

export async function verifyEmail(payload: VerifyEmailPayload) {
  const response = await http.post<ApiResponse<AuthTokens>>(
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

export type CalendarActivityRange = {
  firstActivityDate: string | null;
};

export async function getCalendarActivityRange() {
  const response = await http.get<ApiResponse<CalendarActivityRange>>(
    "/api/calendar/activity-range"
  );
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

export async function listEmployments() {
  const response = await http.get<ApiResponse<Employment[]>>("/api/employments");
  return response.data.data;
}

export async function getEmployment(id: string) {
  const response = await http.get<ApiResponse<Employment>>(`/api/employments/${id}`);
  return response.data.data;
}

export async function createEmployment(payload: EmploymentPayload) {
  const response = await http.post<ApiResponse<Employment>>("/api/employments", payload);
  return response.data.data;
}

export async function updateEmployment(id: string, payload: EmploymentPayload) {
  const response = await http.put<ApiResponse<Employment>>(`/api/employments/${id}`, payload);
  return response.data.data;
}

export async function deleteEmployment(id: string) {
  await http.delete(`/api/employments/${id}`);
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

export async function listAddresses() {
  const response = await http.get<ApiResponse<Address[]>>("/api/addresses");
  return response.data.data;
}

export async function createAddress(payload: AddressPayload) {
  const response = await http.post<ApiResponse<Address>>("/api/addresses", payload);
  return response.data.data;
}

export async function updateAddress(id: string, payload: AddressPayload) {
  const response = await http.put<ApiResponse<Address>>(`/api/addresses/${id}`, payload);
  return response.data.data;
}

export async function deleteAddress(id: string) {
  await http.delete(`/api/addresses/${id}`);
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

export type TrackingSetupStatus = {
  requiredVersion: number;
  completedVersion: number;
  completed: boolean;
};

export async function getTrackingSetupStatus() {
  const response = await http.get<ApiResponse<TrackingSetupStatus>>(
    "/api/tracking-setup/current"
  );
  return response.data.data;
}

export async function completeTrackingSetup() {
  const response = await http.post<ApiResponse<UserPreferences>>(
    "/api/tracking-setup/current/complete"
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

export async function getDashboard() {
  const response = await http.get<ApiResponse<DashboardResponse>>("/api/dashboard");
  return response.data.data;
}

export async function getCurrentWorkSession() {
  const response = await http.get<ApiResponse<WorkSession | null>>("/api/work-sessions/current");
  return response.data.data;
}

export async function checkInToWorkSession(payload: { workTypeId: string; timezone: string }) {
  const response = await http.post<ApiResponse<WorkSession>>("/api/work-sessions/check-in", payload);
  return response.data.data;
}

export async function checkOutOfWorkSession(payload: WorkSessionCheckoutPayload = {}) {
  const response = await http.post<ApiResponse<WorkSession>>("/api/work-sessions/check-out", payload);
  return response.data.data;
}

export async function startWorkSessionPause() {
  const response = await http.post<ApiResponse<WorkSession>>("/api/work-sessions/pause/start");
  return response.data.data;
}

export async function endWorkSessionPause() {
  const response = await http.post<ApiResponse<WorkSession>>("/api/work-sessions/pause/end");
  return response.data.data;
}

export async function cancelCurrentWorkSession() {
  await http.delete("/api/work-sessions/current");
}

export async function createWorkRecord(payload: WorkRecordRequest) {
  const response = await http.post<ApiResponse<WorkRecord>>("/api/work-records", payload);
  return response.data.data;
}

export async function createWorkSession(payload: WorkRecordRequest) {
  const response = await http.post<ApiResponse<WorkRecord>>("/api/work-records/sessions", payload);
  return response.data.data;
}

export async function updateWorkRecord(id: string, payload: WorkRecordRequest) {
  const response = await http.put<ApiResponse<WorkRecord>>(`/api/work-records/${id}`, payload);
  return response.data.data;
}

export async function updateWorkSession(id: string, payload: WorkRecordRequest) {
  const response = await http.put<ApiResponse<WorkRecord>>(`/api/work-records/${id}/session`, payload);
  return response.data.data;
}

export async function getWorkRecord(id: string) {
  const response = await http.get<ApiResponse<WorkRecord>>(`/api/work-records/${id}`);
  return response.data.data;
}

export async function deleteWorkRecord(id: string) {
  await http.delete(`/api/work-records/${id}`);
}

export async function listWorkRecordsForDay(date: string) {
  const response = await http.get<ApiResponse<WorkRecord[]>>("/api/work-records/day", {
    params: { date }
  });
  return response.data.data;
}

export async function listWorkRecordsInRange(params: { from: string; to: string }) {
  const response = await http.get<ApiResponse<WorkRecord[]>>("/api/work-records/range", {
    params
  });
  return response.data.data;
}

export async function getAbsences(
  params?: {
    year?: number;
    month?: number;
    from?: string;
    to?: string;
    absenceTypeId?: string;
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

async function fetchAllPages<T>(url: string, params: Record<string, unknown> = {}) {
  const firstResponse = await http.get<ApiResponse<PageResponse<T>>>(url, {
    params: { ...params, page: 0, size: 100 }
  });
  const firstPage = firstResponse.data.data;
  const content = [...firstPage.content];

  for (let page = 1; page < firstPage.totalPages; page += 1) {
    const response = await http.get<ApiResponse<PageResponse<T>>>(url, {
      params: { ...params, page, size: firstPage.size }
    });
    content.push(...response.data.data.content);
  }

  return content;
}

export type CreateAbsencePayload = {
  employmentId?: string | null;
  absenceTypeId?: string | null;
  absenceType?: AbsenceType;
  startDate: string;
  endDate: string;
  notes?: string | null;
};

export async function createAbsence(payload: CreateAbsencePayload) {
  const response = await http.post<ApiResponse<Absence>>("/api/absences", payload);
  return response.data.data;
}

export async function deleteAbsence(id: string) {
  await http.delete(`/api/absences/${id}`);
}

export function listAbsencesInRange(params: {
  year?: number;
  month?: number;
  from?: string;
  to?: string;
  absenceTypeId?: string;
  absenceType?: AbsenceType;
}) {
  return fetchAllPages<Absence>("/api/absences", params);
}

export type AbsenceTypePayload = {
  name: string;
  code?: AbsenceType | null;
  paid: boolean;
  paidMinutesPerDay: number;
  color?: string | null;
  active?: boolean;
  displayOrder?: number;
};

export async function listAbsenceTypes(activeOnly = true) {
  const response = await http.get<ApiResponse<AbsenceTypeSetting[]>>("/api/absence-types", {
    params: { activeOnly }
  });
  return response.data.data;
}

export async function createAbsenceType(payload: AbsenceTypePayload) {
  const response = await http.post<ApiResponse<AbsenceTypeSetting>>("/api/absence-types", payload);
  return response.data.data;
}

export async function updateAbsenceType(id: string, payload: AbsenceTypePayload) {
  const response = await http.put<ApiResponse<AbsenceTypeSetting>>(`/api/absence-types/${id}`, payload);
  return response.data.data;
}

export async function deleteAbsenceType(id: string) {
  await http.delete(`/api/absence-types/${id}`);
}

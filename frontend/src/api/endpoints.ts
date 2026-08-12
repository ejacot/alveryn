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
import type { FounderDashboard } from "../types/admin";
import type {
  ScheduledShift,
  ShiftOverridePayload,
  WeeklySchedule,
  WeeklySchedulePayload
} from "../types/schedule";
import type { EmploymentRestDay } from "../types/rest-day";
import type { WorkProject, WorkProjectPayload } from "../types/work-project";
import type {
  DataImportAnalysisResponse,
  DataImportCandidateDecision,
  DataImportConfirmResponse,
  DataImportPreviewResponse,
  DataImportExecuteResponse,
  DataImportQuestionResolution,
  DataImportChatMessage,
  DataImportChatResponse,
  DataImportScope
} from "../types/data-import";
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

export type InitialSetupPayload = {
  firstName: string;
  lastName: string;
  language: string;
  timezone: string;
  currency: string;
  firstDayOfWeek: UserPreferences["firstDayOfWeek"];
  dateFormat: string;
  timeFormat: UserPreferences["timeFormat"];
  theme: UserPreferences["theme"];
  defaultBreakMinutes: number;
  preferredDailyMinutes: number;
  paidSickLeave: boolean;
  sickLeavePaidMinutesPerDay: number;
  paidVacation: boolean;
  vacationPaidMinutesPerDay: number;
  employmentName: string;
  startDate: string;
  compensationType: Employment["compensationType"];
  hourlyRate: number | null;
  fixedSalaryAmount: number | null;
  timerEnabled: boolean;
  hourBalanceEnabled: boolean;
  targetMinutes: number | null;
  hourBalanceValidityMonths: number | null;
  workTypeName: string;
  unitLabel: string | null;
  unitSymbol: string | null;
  ratePerUnit: number | null;
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
  compensationType: Employment["compensationType"] | null;
  trackingFocus: Employment["trackingFocus"];
  hourBalanceEnabled: boolean;
  timerEnabled?: boolean;
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

export async function analyzeDataImport(
  file: File,
  scope: DataImportScope,
  employmentId?: string,
  payrollFiles: File[] = []
) {
  const body = new FormData();
  body.append("file", file);
  payrollFiles.forEach((payroll) => body.append("payrollFiles", payroll));
  const params = new URLSearchParams({ scope });
  if (employmentId) params.set("employmentId", employmentId);
  const response = await http.post<ApiResponse<DataImportAnalysisResponse>>(
    `/api/data-imports/analyze?${params.toString()}`,
    body,
    { headers: { "Content-Type": undefined } }
  );
  return response.data.data;
}

export async function getDataImportSourceDocument(batchId: string) {
  const response = await http.get<Blob>(`/api/data-imports/${batchId}/source`, {
    responseType: "blob"
  });
  return response.data;
}

export async function confirmDataImport(
  batchId: string,
  candidates: DataImportCandidateDecision[]
) {
  const response = await http.post<ApiResponse<DataImportConfirmResponse>>(
    `/api/data-imports/${batchId}/confirm`,
    { candidates }
  );
  return response.data.data;
}

export async function previewDataImport(batchId: string) {
  const response = await http.get<ApiResponse<DataImportPreviewResponse>>(
    `/api/data-imports/${batchId}/preview`
  );
  return response.data.data;
}

export async function setDataImportPeriod(batchId: string, year: number, month: number) {
  const response = await http.put<ApiResponse<DataImportAnalysisResponse>>(
    `/api/data-imports/${batchId}/period`,
    { year, month }
  );
  return response.data.data;
}

export async function setDataImportSheetPeriods(
  batchId: string,
  sheets: Array<{ sheet: string; year: number; month: number }>
) {
  const response = await http.put<ApiResponse<DataImportAnalysisResponse>>(
    `/api/data-imports/${batchId}/period`,
    { sheets }
  );
  return response.data.data;
}

export async function executeDataImport(
  batchId: string,
  entryIds: string[],
  resolutions: Record<string, DataImportQuestionResolution>,
  entryOverrides: Record<string, { notes: string; lineValues: number[] }> = {}
) {
  const response = await http.post<ApiResponse<DataImportExecuteResponse>>(
    `/api/data-imports/${batchId}/import`,
    { entryIds, resolutions, entryOverrides }
  );
  return response.data.data;
}

export async function chatAboutDataImportQuestion(
  batchId: string,
  questionId: string,
  messages: DataImportChatMessage[]
) {
  const response = await http.post<ApiResponse<DataImportChatResponse>>(
    `/api/data-imports/${batchId}/questions/chat`,
    { questionId, messages }
  );
  return response.data.data;
}

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
  const response = await http.post<ApiResponse<AuthTokens>>(
    "/api/auth/reset-password",
    payload
  );
  return response.data.data;
}

export async function verifyPasswordResetCode(payload: Pick<ResetPasswordPayload, "email" | "code">) {
  const response = await http.post<ApiResponse<ApiMessage>>(
    "/api/auth/verify-password-reset-code",
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

export async function getFounderDashboard() {
  const response = await http.get<ApiResponse<FounderDashboard>>("/api/admin/dashboard");
  return response.data.data;
}

export async function recordPdfExport() {
  await http.post("/api/analytics/pdf-export");
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

export type EmploymentExtraPayRule = {
  id: string;
  weekday: "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY";
  percentage: number;
};

export async function listEmploymentExtraPayRules(employmentId: string) {
  const response = await http.get<ApiResponse<EmploymentExtraPayRule[]>>(
    `/api/employments/${employmentId}/extra-pay-rules`
  );
  return response.data.data;
}

export async function saveEmploymentExtraPayRule(
  employmentId: string,
  weekday: EmploymentExtraPayRule["weekday"],
  percentage: number
) {
  const response = await http.put<ApiResponse<EmploymentExtraPayRule>>(
    `/api/employments/${employmentId}/extra-pay-rules/${weekday}`,
    { percentage }
  );
  return response.data.data;
}

export async function deleteEmploymentExtraPayRule(
  employmentId: string,
  weekday: EmploymentExtraPayRule["weekday"]
) {
  await http.delete(`/api/employments/${employmentId}/extra-pay-rules/${weekday}`);
}

export type EmploymentExtraPayTimeRule = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  percentage: number;
};

export async function listEmploymentExtraPayTimeRules(employmentId: string) {
  const response = await http.get<ApiResponse<EmploymentExtraPayTimeRule[]>>(
    `/api/employments/${employmentId}/extra-pay-rules/time-intervals`
  );
  return response.data.data;
}

export async function createEmploymentExtraPayTimeRule(
  employmentId: string,
  payload: Pick<EmploymentExtraPayTimeRule, "name" | "startTime" | "endTime" | "percentage">
) {
  const response = await http.post<ApiResponse<EmploymentExtraPayTimeRule>>(
    `/api/employments/${employmentId}/extra-pay-rules/time-intervals`, payload
  );
  return response.data.data;
}

export async function deleteEmploymentExtraPayTimeRule(employmentId: string, ruleId: string) {
  await http.delete(`/api/employments/${employmentId}/extra-pay-rules/time-intervals/${ruleId}`);
}

export async function deleteEmployment(id: string) {
  await http.delete(`/api/employments/${id}`);
}

export async function getWeeklySchedule(employmentId: string) {
  const response = await http.get<ApiResponse<WeeklySchedule | null>>(
    `/api/employments/${employmentId}/schedule`
  );
  return response.data.data;
}

export async function saveWeeklySchedule(employmentId: string, payload: WeeklySchedulePayload) {
  const response = await http.put<ApiResponse<WeeklySchedule>>(
    `/api/employments/${employmentId}/schedule`,
    payload
  );
  return response.data.data;
}

export async function getScheduledShifts(employmentId: string, from: string, to: string) {
  const response = await http.get<ApiResponse<ScheduledShift[]>>(
    `/api/employments/${employmentId}/schedule/shifts`,
    { params: { from, to } }
  );
  return response.data.data;
}

export async function overrideScheduledShift(
  employmentId: string,
  assignmentId: string,
  payload: ShiftOverridePayload
) {
  const response = await http.put<ApiResponse<ScheduledShift>>(
    `/api/employments/${employmentId}/schedule/shifts/${assignmentId}`,
    payload
  );
  return response.data.data;
}

export async function listRestDays(employmentId: string, from: string, to: string) {
  const response = await http.get<ApiResponse<EmploymentRestDay[]>>(
    `/api/employments/${employmentId}/rest-days`,
    { params: { from, to } }
  );
  return response.data.data;
}

export async function markRestDay(employmentId: string, date: string, notes: string | null = null) {
  const response = await http.put<ApiResponse<EmploymentRestDay>>(
    `/api/employments/${employmentId}/rest-days/${date}`,
    { notes }
  );
  return response.data.data;
}

export async function removeRestDay(employmentId: string, date: string) {
  await http.delete(`/api/employments/${employmentId}/rest-days/${date}`);
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

export async function listWorkProjects() {
  const response = await http.get<ApiResponse<WorkProject[]>>("/api/work-projects");
  return response.data.data;
}

export async function createWorkProject(payload: WorkProjectPayload) {
  const response = await http.post<ApiResponse<WorkProject>>("/api/work-projects", payload);
  return response.data.data;
}

export async function createWorkProjectWithTotals(
  project: WorkProjectPayload,
  totals: WorkRecordRequest
) {
  const response = await http.post<ApiResponse<WorkRecord>>(
    "/api/work-projects/with-totals",
    { project, totals }
  );
  return response.data.data;
}

export async function updateWorkProject(id: string, payload: WorkProjectPayload) {
  const response = await http.put<ApiResponse<WorkProject>>(`/api/work-projects/${id}`, payload);
  return response.data.data;
}

export async function createProjectTotal(projectId: string, payload: WorkRecordRequest) {
  const response = await http.post<ApiResponse<WorkRecord>>(`/api/work-projects/${projectId}/totals`, payload);
  return response.data.data;
}

export async function createProjectSession(projectId: string, payload: WorkRecordRequest) {
  const response = await http.post<ApiResponse<WorkRecord>>(`/api/work-projects/${projectId}/sessions`, payload);
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

export async function completeInitialSetup(payload: InitialSetupPayload) {
  const response = await http.post<ApiResponse<{
    employmentId: string;
    workTypeId: string;
    status: OnboardingStatus;
  }>>("/api/onboarding/initial-setup", payload);
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
  const response = await http.get<ApiResponse<WorkRecord[]>>("/api/work-records/range-summary", {
    params
  });
  return response.data.data;
}

export async function listFullWorkRecordsInRange(params: { from: string; to: string }) {
  const response = await http.get<ApiResponse<WorkRecord[]>>("/api/work-records/range", { params });
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

export type PayrollReconciliation = {
  filename?: string;
  year?: number;
  month?: number;
  normalHours?: number | null;
  normalRate?: number | null;
  normalAmount?: number | null;
  absenceLabel?: string | null;
  absenceDays?: number | null;
  absenceHours?: number | null;
  absenceRate?: number | null;
  absenceAmount?: number | null;
  extraHours?: number | null;
  extraAmount?: number | null;
  grossAmount?: number | null;
  confidence?: number;
  status?: string;
  countryCode?: string | null;
  languageCode?: string | null;
  currency?: string | null;
  documentCompleteness?: "FULL_PAGE" | "FRAGMENT" | null;
  requiresReview?: boolean;
  warnings?: string[];
  payrollLines?: Array<{
    code?: string | null;
    label?: string | null;
    category?: string | null;
    quantity?: number | null;
    unit?: string | null;
    factor?: number | null;
    percentage?: number | null;
    amount?: number | null;
    grossRelevant?: boolean | null;
    confidence?: number | null;
    evidenceText?: string | null;
  }>;
};

export async function reconcileMonthlyPayroll(file: File, year: number, month: number) {
  const data = new FormData();
  data.append("file", file);
  const response = await http.post<ApiResponse<PayrollReconciliation>>(
    "/api/data-imports/payroll-reconciliation", data, {
      params: { year, month },
      headers: { "Content-Type": undefined }
    }
  );
  let payload: unknown = response.data?.data;
  if (typeof payload === "string") {
    payload = JSON.parse(payload) as unknown;
  }
  if (
    payload &&
    typeof payload === "object" &&
    "data" in payload &&
    !("normalHours" in payload)
  ) {
    payload = (payload as { data: unknown }).data;
  }
  if (!payload || typeof payload !== "object") {
    throw new Error("The payroll server returned an invalid response");
  }
  return payload as PayrollReconciliation;
}

export type SavedPayrollReconciliation = {
  id: string;
  status: string;
  workedHoursDifference?: number | null;
  absenceHoursDifference?: number | null;
  extraHoursDifference?: number | null;
  grossDifference?: number | null;
};

export type PayrollReconciliationDetail = SavedPayrollReconciliation & {
  employmentId: string;
  year: number;
  month: number;
  filename?: string | null;
  appWorkedHours?: number | null;
  appAbsenceHours?: number | null;
  appExtraHours?: number | null;
  appGross?: number | null;
  payrollWorkedHours?: number | null;
  payrollAbsenceHours?: number | null;
  payrollExtraHours?: number | null;
  payrollGross?: number | null;
  payrollLines: NonNullable<PayrollReconciliation["payrollLines"]>;
  notes?: string | null;
  documentAvailable: boolean;
  documentFilename?: string | null;
  documentContentType?: string | null;
  documentSize?: number | null;
};

export async function getPayrollReconciliation(
  employmentId: string,
  year: number,
  month: number
) {
  const response = await http.get<ApiResponse<PayrollReconciliationDetail | null>>(
    "/api/data-imports/payroll-reconciliations",
    { params: { employmentId, year, month } }
  );
  return response.data.data;
}

export async function savePayrollReconciliation(payload: {
  employmentId: string;
  year: number;
  month: number;
  filename?: string;
  appWorkedHours: number;
  appAbsenceHours: number;
  appExtraHours: number;
  appGross: number;
  payrollWorkedHours?: number | null;
  payrollAbsenceHours?: number | null;
  payrollExtraHours?: number | null;
  payrollGross?: number | null;
  payrollLines: NonNullable<PayrollReconciliation["payrollLines"]>;
  notes?: string;
}) {
  const response = await http.post<ApiResponse<SavedPayrollReconciliation>>(
    "/api/data-imports/payroll-reconciliations", payload
  );
  return response.data.data;
}

export async function uploadPayrollReconciliationDocument(
  reconciliationId: string,
  file: File
) {
  const data = new FormData();
  data.append("file", file);
  await http.put(
    `/api/data-imports/payroll-reconciliations/${reconciliationId}/document`,
    data,
    { headers: { "Content-Type": undefined } }
  );
}

export async function getPayrollReconciliationDocument(reconciliationId: string) {
  const response = await http.get<Blob>(
    `/api/data-imports/payroll-reconciliations/${reconciliationId}/document`,
    { responseType: "blob" }
  );
  return response.data;
}

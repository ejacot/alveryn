import type { ApiMessage, ApiResponse, PageResponse } from "../types/api";
import type { CurrentUser, AuthTokens, AuthUser } from "../types/auth";
import type { DashboardResponse, WorkEntrySummary } from "../types/dashboard";
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

export async function getDashboard() {
  const response = await http.get<ApiResponse<DashboardResponse>>("/api/dashboard");
  return response.data.data;
}

export async function getWorkEntries(params?: { page?: number; size?: number }) {
  const response =
    await http.get<ApiResponse<PageResponse<WorkEntrySummary>>>("/api/work-entries", {
      params
    });
  return response.data.data;
}

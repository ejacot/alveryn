import axios, {
  AxiosError,
  type AxiosRequestHeaders,
  type InternalAxiosRequestConfig
} from "axios";
import type { ApiErrorResponse, ApiResponse } from "../types/api";
import type { AuthTokens } from "../types/auth";
import { API_BASE_URL, buildApiUrl } from "./config";
import {
  clearTokens,
  getStoredAccessToken,
  getStoredRefreshToken,
  storeTokens
} from "./auth-storage";

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  request: InternalAxiosRequestConfig & { _retry?: boolean };
};

type AuthFailureHandler = () => void;

let isRefreshing = false;
let pendingRequests: PendingRequest[] = [];
let authFailureHandler: AuthFailureHandler | null = null;

const REFRESH_EXCLUDED_PATHS = [
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/verify-email",
  "/api/auth/resend-verification",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/refresh",
  "/api/auth/logout"
];

function resolvePendingRequests(token: string) {
  pendingRequests.forEach(({ request, resolve, reject }) => {
    try {
      request.headers = request.headers ?? ({} as AxiosRequestHeaders);
      request.headers.Authorization = `Bearer ${token}`;
      resolve(http(request));
    } catch (error) {
      reject(error);
    }
  });
  pendingRequests = [];
}

function rejectPendingRequests(error: unknown) {
  pendingRequests.forEach(({ reject }) => reject(error));
  pendingRequests = [];
}

function shouldSkipRefresh(url?: string) {
  return REFRESH_EXCLUDED_PATHS.some((path) => url?.includes(path));
}

function handleAuthFailure() {
  clearTokens();
  authFailureHandler?.();
}

async function refreshTokens() {
  const refreshToken = getStoredRefreshToken();

  if (!refreshToken) {
    throw new Error("Missing refresh token");
  }

  const response = await axios.post<ApiResponse<AuthTokens>>(
    buildApiUrl("/api/auth/refresh"),
    { refreshToken }
  );

  storeTokens(response.data.data.accessToken, response.data.data.refreshToken);
  return response.data.data.accessToken;
}

export function setAuthFailureHandler(handler: AuthFailureHandler | null) {
  authFailureHandler = handler;
}

export const http = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json"
  }
});

http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getStoredAccessToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorResponse>) => {
    const originalRequest = error.config as
      | (InternalAxiosRequestConfig & {
          _retry?: boolean;
        })
      | undefined;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    const requestWithRetry = originalRequest as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (
      error.response?.status !== 401 ||
      requestWithRetry._retry ||
      shouldSkipRefresh(requestWithRetry.url)
    ) {
      return Promise.reject(error);
    }

    if (!getStoredRefreshToken()) {
      handleAuthFailure();
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingRequests.push({ resolve, reject, request: requestWithRetry });
      });
    }

    requestWithRetry._retry = true;
    isRefreshing = true;

    try {
      const nextToken = await refreshTokens();
      resolvePendingRequests(nextToken);
      requestWithRetry.headers = requestWithRetry.headers ?? ({} as AxiosRequestHeaders);
      requestWithRetry.headers.Authorization = `Bearer ${nextToken}`;
      return http(requestWithRetry);
    } catch (refreshError) {
      handleAuthFailure();
      rejectPendingRequests(refreshError);
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export function __resetHttpStateForTests() {
  isRefreshing = false;
  pendingRequests = [];
  authFailureHandler = null;
}

import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import type { ApiErrorResponse, ApiResponse } from "../types/api";
import type { AuthTokens } from "../types/auth";
import {
  clearTokens,
  getStoredAccessToken,
  getStoredRefreshToken,
  storeTokens
} from "./auth-storage";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";

type PendingSubscriber = (token: string | null) => void;

let isRefreshing = false;
let subscribers: PendingSubscriber[] = [];

function notifySubscribers(token: string | null) {
  subscribers.forEach((callback) => callback(token));
  subscribers = [];
}

async function refreshTokens() {
  const refreshToken = getStoredRefreshToken();

  if (!refreshToken) {
    throw new Error("Missing refresh token");
  }

  const response = await axios.post<ApiResponse<AuthTokens>>(
    `${API_BASE_URL}/api/auth/refresh`,
    { refreshToken }
  );

  storeTokens(response.data.data.accessToken, response.data.data.refreshToken);
  return response.data.data.accessToken;
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
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (
      error.response?.status !== 401 ||
      originalRequest._retry ||
      originalRequest.url?.includes("/api/auth/login") ||
      originalRequest.url?.includes("/api/auth/refresh")
    ) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        subscribers.push((token) => {
          if (!token) {
            reject(error);
            return;
          }

          originalRequest.headers.Authorization = `Bearer ${token}`;
          resolve(http(originalRequest));
        });
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const nextToken = await refreshTokens();
      notifySubscribers(nextToken);
      originalRequest.headers.Authorization = `Bearer ${nextToken}`;
      return http(originalRequest);
    } catch (refreshError) {
      clearTokens();
      notifySubscribers(null);
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

import axios from "axios";
import type { ApiErrorResponse } from "../types/api";

export type ParsedApiError = {
  status: number | null;
  message: string;
  fieldErrors: Record<string, string>;
  errors: string[];
  isAuthError: boolean;
  isConflict: boolean;
  isNetworkError: boolean;
  isServerUnavailable: boolean;
};

const DEFAULT_ERROR: ParsedApiError = {
  status: null,
  message: "Something went wrong. Please try again.",
  fieldErrors: {},
  errors: [],
  isAuthError: false,
  isConflict: false,
  isNetworkError: false,
  isServerUnavailable: false
};

function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "message" in value &&
    "status" in value &&
    "errors" in value
  );
}

function parseFieldErrors(errors: string[]) {
  return errors.reduce<Record<string, string>>((accumulator, entry) => {
    const separator = entry.indexOf(":");
    if (separator <= 0) {
      return accumulator;
    }

    const field = entry.slice(0, separator).trim();
    const message = entry.slice(separator + 1).trim();

    if (field && message && !(field in accumulator)) {
      accumulator[field] = message;
    }

    return accumulator;
  }, {});
}

export function getApiError(error: unknown): ParsedApiError {
  if (!axios.isAxiosError(error)) {
    return DEFAULT_ERROR;
  }

  if (!error.response) {
    return {
      ...DEFAULT_ERROR,
      message: "Roomly could not reach the backend. Check the server and try again.",
      isNetworkError: true,
      isServerUnavailable: true
    };
  }

  const { status, data } = error.response;

  if (!isApiErrorResponse(data)) {
    return {
      ...DEFAULT_ERROR,
      status,
      message:
        status >= 500
          ? "Roomly is temporarily unavailable. Try again in a moment."
          : "The backend returned an unexpected response.",
      isServerUnavailable: status >= 500
    };
  }

  const fieldErrors = parseFieldErrors(data.errors);
  const fallbackFieldMessage = Object.values(fieldErrors)[0];
  const message = data.message || fallbackFieldMessage || DEFAULT_ERROR.message;

  return {
    status: data.status,
    message,
    fieldErrors,
    errors: data.errors,
    isAuthError: data.status === 401,
    isConflict: data.status === 409,
    isNetworkError: false,
    isServerUnavailable: data.status >= 500
  };
}

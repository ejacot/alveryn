import axios from "axios";
import { i18n } from "../i18n";
import type { ApiErrorResponse } from "../types/api";

export type ParsedApiError = {
  status: number | null;
  code: string | null;
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
  code: null,
  message: i18n.t("common:messages.genericError"),
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

function extractTimeOverlapParams(message?: string | null) {
  const match = message?.match(/\bfrom\s+(\d{2}:\d{2})\s+to\s+(\d{2}:\d{2})\b/i);
  if (!match) {
    return {};
  }

  return {
    start: match[1],
    end: match[2]
  };
}

function localizeMessage(code?: string | null, fallback?: string | null) {
  if (code && i18n.exists(`errors:${code}`)) {
    return i18n.t(`errors:${code}`, extractTimeOverlapParams(fallback));
  }
  return fallback || DEFAULT_ERROR.message;
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

function isGenericValidationMessage(message?: string | null) {
  if (!message) {
    return false;
  }

  const normalized = message.trim().toLowerCase();
  return normalized === "validation failed";
}

export function getApiError(error: unknown): ParsedApiError {
  if (!axios.isAxiosError(error)) {
    return DEFAULT_ERROR;
  }

  if (!error.response) {
    return {
      ...DEFAULT_ERROR,
      code: null,
      message: i18n.t("common:messages.networkError"),
      isNetworkError: true,
      isServerUnavailable: true
    };
  }

  const { status, data } = error.response;

  if (!isApiErrorResponse(data)) {
    return {
      ...DEFAULT_ERROR,
      status,
      code: null,
      message:
        status >= 500
          ? i18n.t("common:messages.serverUnavailable")
          : i18n.t("common:messages.unexpectedResponse"),
      isServerUnavailable: status >= 500
    };
  }

  const fieldErrors = parseFieldErrors(data.errors);
  const fallbackFieldMessage = Object.values(fieldErrors)[0];
  const fallbackErrorMessage = data.errors[0];
  const message = localizeMessage(
    data.code,
    isGenericValidationMessage(data.message)
      ? fallbackFieldMessage || fallbackErrorMessage || data.message
      : data.message || fallbackFieldMessage || fallbackErrorMessage || DEFAULT_ERROR.message
  );

  return {
    status: data.status,
    code: data.code ?? null,
    message,
    fieldErrors,
    errors: data.errors,
    isAuthError: data.status === 401,
    isConflict: data.status === 409,
    isNetworkError: false,
    isServerUnavailable: data.status >= 500
  };
}

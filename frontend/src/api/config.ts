function normalizeBaseUrl(value?: string) {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }

  return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
}

export const API_BASE_URL = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL) ?? "/";

export const DEV_PROXY_TARGET =
  normalizeBaseUrl(import.meta.env.VITE_DEV_PROXY_TARGET) ?? "http://localhost:8080";

export const PREVIEW_ROUTES_ENABLED =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_PREVIEW_ROUTES === "true";

export const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL?.trim() || "roomly000app@gmail.com";

export function buildApiUrl(path: `/api/${string}` | `/actuator/${string}`) {
  if (API_BASE_URL === "/") {
    return path;
  }

  return `${API_BASE_URL}${path}`;
}

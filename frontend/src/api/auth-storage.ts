const ACCESS_TOKEN_KEY = "roomly.access-token";
const REFRESH_TOKEN_KEY = "roomly.refresh-token";

type AuthStorageListener = () => void;

const listeners = new Set<AuthStorageListener>();

function readToken(key: string) {
  const value = localStorage.getItem(key)?.trim();
  return value ? value : null;
}

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

export function getStoredAccessToken() {
  return readToken(ACCESS_TOKEN_KEY);
}

export function getStoredRefreshToken() {
  return readToken(REFRESH_TOKEN_KEY);
}

export function hasStoredSession() {
  return Boolean(getStoredAccessToken() || getStoredRefreshToken());
}

export function storeTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  notifyListeners();
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  notifyListeners();
}

export function subscribeToAuthStorage(listener: AuthStorageListener) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

// TODO: migrate refresh token storage to an HttpOnly cookie before any public production launch.

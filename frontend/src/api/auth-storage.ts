const ACCESS_TOKEN_KEY = "roomly.access-token";
const REFRESH_TOKEN_KEY = "roomly.refresh-token";
const AUTH_SYNC_CHANNEL = "roomly.auth-sync";

type AuthStorageListener = () => void;
type AuthSyncMessage = { type: "login" | "logout" | "refresh" };

const listeners = new Set<AuthStorageListener>();
const channel =
  typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(AUTH_SYNC_CHANNEL);

function readToken(key: string) {
  const value = localStorage.getItem(key)?.trim();
  return value ? value : null;
}

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

function broadcast(message: AuthSyncMessage) {
  channel?.postMessage(message);
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
  broadcast({ type: "login" });
  notifyListeners();
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  broadcast({ type: "logout" });
  notifyListeners();
}

export function notifyTokensRefreshed() {
  broadcast({ type: "refresh" });
  notifyListeners();
}

export function subscribeToAuthStorage(listener: AuthStorageListener) {
  listeners.add(listener);
  const handleStorage = (event: StorageEvent) => {
    if (
      event.key === ACCESS_TOKEN_KEY ||
      event.key === REFRESH_TOKEN_KEY ||
      event.key === null
    ) {
      listener();
    }
  };
  const handleBroadcast = () => {
    listener();
  };

  window.addEventListener("storage", handleStorage);
  channel?.addEventListener("message", handleBroadcast);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", handleStorage);
    channel?.removeEventListener("message", handleBroadcast);
  };
}

// TODO: migrate refresh token storage to an HttpOnly cookie before any public production launch.

const LEGACY_ACCESS_TOKEN_KEY = "roomly.access-token";
const LEGACY_REFRESH_TOKEN_KEY = "roomly.refresh-token";
const SESSION_MARKER_KEY = "roomly.session";
const AUTH_SYNC_CHANNEL = "roomly.auth-sync";

type AuthStorageListener = () => void;
type AuthSyncMessage = { type: "login" | "logout" | "session-changed" };

let accessToken: string | null = null;

const listeners = new Set<AuthStorageListener>();
const channel =
  typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(AUTH_SYNC_CHANNEL);

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

function broadcast(message: AuthSyncMessage) {
  channel?.postMessage(message);
}

function setSessionMarker(active: boolean) {
  if (active) {
    localStorage.setItem(SESSION_MARKER_KEY, "1");
  } else {
    localStorage.removeItem(SESSION_MARKER_KEY);
  }
}

export function getStoredAccessToken() {
  return accessToken;
}

export function setStoredAccessToken(token: string | null) {
  accessToken = token?.trim() ? token : null;
}

export function hasStoredSession() {
  return localStorage.getItem(SESSION_MARKER_KEY) === "1";
}

export function markSessionActive() {
  localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
  localStorage.removeItem(LEGACY_REFRESH_TOKEN_KEY);
  setSessionMarker(true);
}

export function storeSession(access: string) {
  setStoredAccessToken(access);
  markSessionActive();
  broadcast({ type: "login" });
  notifyListeners();
}

export function clearTokens() {
  setStoredAccessToken(null);
  localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
  localStorage.removeItem(LEGACY_REFRESH_TOKEN_KEY);
  setSessionMarker(false);
  broadcast({ type: "logout" });
  notifyListeners();
}

export function notifySessionChanged() {
  broadcast({ type: "session-changed" });
  notifyListeners();
}

export function subscribeToAuthStorage(listener: AuthStorageListener) {
  listeners.add(listener);

  const handleStorage = (event: StorageEvent) => {
    if (
      event.key === SESSION_MARKER_KEY ||
      event.key === LEGACY_ACCESS_TOKEN_KEY ||
      event.key === LEGACY_REFRESH_TOKEN_KEY ||
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

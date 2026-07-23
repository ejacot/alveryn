import { buildApiUrl } from "../api/config";

export type MarketingEvent = "LANDING_VIEW" | "REGISTRATION_STARTED";

const VISITOR_ID_KEY = "alveryn.marketingVisitorId";
const SESSION_EVENT_PREFIX = "alveryn.marketingEvent.";

function createVisitorId() {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function getVisitorId() {
  const existing = window.sessionStorage.getItem(VISITOR_ID_KEY);
  if (existing) {
    return existing;
  }

  const visitorId = createVisitorId();
  window.sessionStorage.setItem(VISITOR_ID_KEY, visitorId);
  return visitorId;
}

export function recordMarketingEvent(eventType: MarketingEvent) {
  if (typeof window === "undefined") {
    return;
  }

  const sessionKey = `${SESSION_EVENT_PREFIX}${eventType}`;
  if (window.sessionStorage.getItem(sessionKey)) {
    return;
  }
  window.sessionStorage.setItem(sessionKey, "1");

  void fetch(buildApiUrl("/api/analytics/public-event"), {
    method: "POST",
    credentials: "omit",
    keepalive: true,
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      eventType,
      anonymousId: getVisitorId()
    })
  }).catch(() => {
    window.sessionStorage.removeItem(sessionKey);
  });
}

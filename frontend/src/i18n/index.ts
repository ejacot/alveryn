import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { detectBrowserLanguage, normalizeLanguage } from "./language";

import commonEn from "./locales/en/common.json";
import authEn from "./locales/en/auth.json";
import onboardingEn from "./locales/en/onboarding.json";
import dashboardEn from "./locales/en/dashboard.json";
import calendarEn from "./locales/en/calendar.json";
import entriesEn from "./locales/en/entries.json";
import settingsEn from "./locales/en/settings.json";
import errorsEn from "./locales/en/errors.json";
import welcomeEn from "./locales/en/welcome.json";

import commonDe from "./locales/de/common.json";
import authDe from "./locales/de/auth.json";
import onboardingDe from "./locales/de/onboarding.json";
import dashboardDe from "./locales/de/dashboard.json";
import calendarDe from "./locales/de/calendar.json";
import entriesDe from "./locales/de/entries.json";
import settingsDe from "./locales/de/settings.json";
import errorsDe from "./locales/de/errors.json";
import welcomeDe from "./locales/de/welcome.json";

import commonRo from "./locales/ro/common.json";
import authRo from "./locales/ro/auth.json";
import onboardingRo from "./locales/ro/onboarding.json";
import dashboardRo from "./locales/ro/dashboard.json";
import calendarRo from "./locales/ro/calendar.json";
import entriesRo from "./locales/ro/entries.json";
import settingsRo from "./locales/ro/settings.json";
import errorsRo from "./locales/ro/errors.json";
import welcomeRo from "./locales/ro/welcome.json";

const resources = {
  en: {
    common: commonEn,
    auth: authEn,
    onboarding: onboardingEn,
    dashboard: dashboardEn,
    calendar: calendarEn,
    entries: entriesEn,
    settings: settingsEn,
    errors: errorsEn,
    welcome: welcomeEn
  },
  de: {
    common: commonDe,
    auth: authDe,
    onboarding: onboardingDe,
    dashboard: dashboardDe,
    calendar: calendarDe,
    entries: entriesDe,
    settings: settingsDe,
    errors: errorsDe,
    welcome: welcomeDe
  },
  ro: {
    common: commonRo,
    auth: authRo,
    onboarding: onboardingRo,
    dashboard: dashboardRo,
    calendar: calendarRo,
    entries: entriesRo,
    settings: settingsRo,
    errors: errorsRo,
    welcome: welcomeRo
  }
} as const;

export function applyAppLanguage(language?: string | null) {
  const nextLanguage = normalizeLanguage(language);
  if (i18n.resolvedLanguage !== nextLanguage) {
    void i18n.changeLanguage(nextLanguage);
  }

  if (typeof document !== "undefined") {
    document.documentElement.lang = nextLanguage;
  }

  return nextLanguage;
}

void i18n.use(initReactI18next).init({
  resources,
  lng: detectBrowserLanguage(),
  fallbackLng: "en",
  defaultNS: "common",
  ns: ["common", "auth", "onboarding", "dashboard", "calendar", "entries", "settings", "errors", "welcome"],
  interpolation: {
    escapeValue: false
  },
  returnNull: false
});

applyAppLanguage(i18n.language);

export { i18n };

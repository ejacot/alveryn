export const SUPPORTED_LANGUAGES = ["en", "de", "ro", "ru"] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_STORAGE_KEY = "alveryn.language";

const LANGUAGE_ALIASES: Record<string, SupportedLanguage> = {
  en: "en",
  "en-us": "en",
  "en-gb": "en",
  de: "de",
  "de-de": "de",
  "de-at": "de",
  "de-ch": "de",
  ro: "ro",
  "ro-ro": "ro",
  "ro-md": "ro",
  ru: "ru",
  "ru-ru": "ru",
  "ru-by": "ru",
  "ru-kz": "ru"
};

export function normalizeLanguage(value?: string | null): SupportedLanguage {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return "en";
  }

  return LANGUAGE_ALIASES[normalized] ?? LANGUAGE_ALIASES[normalized.split("-")[0] ?? ""] ?? "en";
}

export function detectBrowserLanguage(): SupportedLanguage {
  if (typeof window !== "undefined") {
    try {
      const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (storedLanguage) {
        return normalizeLanguage(storedLanguage);
      }
    } catch {
      // Storage can be unavailable in private or restricted browsing contexts.
    }
  }

  if (typeof navigator === "undefined") {
    return "en";
  }

  return normalizeLanguage(navigator.language);
}

export function storeLanguagePreference(language: SupportedLanguage) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // The active session can still use the selected language without persistence.
  }
}

export function getNativeLanguageName(language: SupportedLanguage) {
  switch (language) {
    case "de":
      return "Deutsch";
    case "ro":
      return "Română";
    case "ru":
      return "Русский";
    case "en":
    default:
      return "English";
  }
}

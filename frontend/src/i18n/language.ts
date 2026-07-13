export const SUPPORTED_LANGUAGES = ["en", "de", "ro"] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

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
  "ro-md": "ro"
};

export function normalizeLanguage(value?: string | null): SupportedLanguage {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return "en";
  }

  return LANGUAGE_ALIASES[normalized] ?? LANGUAGE_ALIASES[normalized.split("-")[0] ?? ""] ?? "en";
}

export function detectBrowserLanguage(): SupportedLanguage {
  if (typeof navigator === "undefined") {
    return "en";
  }

  return normalizeLanguage(navigator.language);
}

export function getNativeLanguageName(language: SupportedLanguage) {
  switch (language) {
    case "de":
      return "Deutsch";
    case "ro":
      return "Romana";
    case "en":
    default:
      return "English";
  }
}

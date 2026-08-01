import { describe, expect, it } from "vitest";
import { i18n } from "./index";
import {
  getNativeLanguageName,
  normalizeLanguage,
  SUPPORTED_LANGUAGES
} from "./language";

describe("Russian language support", () => {
  it("normalizes Russian locales and exposes the native language name", () => {
    expect(SUPPORTED_LANGUAGES).toContain("ru");
    expect(normalizeLanguage("ru-RU")).toBe("ru");
    expect(normalizeLanguage("ru-KZ")).toBe("ru");
    expect(getNativeLanguageName("ru")).toBe("Русский");
  });

  it("loads Russian translations for the primary application surfaces", async () => {
    await i18n.changeLanguage("ru");

    expect(i18n.t("nav.calendar", { ns: "common" })).toBe("Календарь");
    expect(i18n.t("weeklyHours.workEarnings", { ns: "dashboard" })).toBe("Доход за неделю");
    expect(i18n.t("payroll.actions.scan", { ns: "calendar" })).toBe("Сканировать");
    expect(i18n.t("preferencesFields.language", { ns: "settings" })).toBe("Язык");

    await i18n.changeLanguage("en");
  });
});

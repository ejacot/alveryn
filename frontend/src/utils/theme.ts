import type { ThemePreference } from "../types/configuration";

const darkThemeColor = "#000000";
const lightThemeColor = "#f5f5f2";
const mediaQuery = "(prefers-color-scheme: dark)";

let currentPreference: ThemePreference = "SYSTEM";

export function applyAppTheme(preference: ThemePreference | null | undefined = "SYSTEM") {
  currentPreference = preference ?? "SYSTEM";
  applyResolvedTheme(resolveTheme(currentPreference));
}

export function initializeSystemThemeListener() {
  const media = window.matchMedia?.(mediaQuery);
  if (!media) {
    applyAppTheme(currentPreference);
    return () => undefined;
  }

  const handleChange = () => {
    if (currentPreference === "SYSTEM") {
      applyResolvedTheme(resolveTheme(currentPreference));
    }
  };

  media.addEventListener("change", handleChange);
  handleChange();

  return () => media.removeEventListener("change", handleChange);
}

function resolveTheme(preference: ThemePreference): "light" | "dark" {
  if (preference === "LIGHT") {
    return "light";
  }
  if (preference === "DARK") {
    return "dark";
  }
  return window.matchMedia?.(mediaQuery).matches ? "dark" : "light";
}

function applyResolvedTheme(theme: "light" | "dark") {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;

  const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (themeColor) {
    themeColor.content = theme === "dark" ? darkThemeColor : lightThemeColor;
  }

  const colorScheme = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
  if (colorScheme) {
    colorScheme.content = "light dark";
  }
}

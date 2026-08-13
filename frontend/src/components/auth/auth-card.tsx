import { useLayoutEffect, useState, type ReactNode } from "react";
import { Languages, Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { AppLogo } from "../branding/app-logo";
import { applyAppLanguage, i18n } from "../../i18n";
import {
  getNativeLanguageName,
  normalizeLanguage,
  storeLanguagePreference,
  SUPPORTED_LANGUAGES
} from "../../i18n/language";
import { applyAppTheme } from "../../utils/theme";

const PUBLIC_THEME_KEY = "alveryn.publicTheme";

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  backLink?: { to: string; label: string };
};

export function AuthCard({ title, subtitle, children, footer, backLink }: Props) {
  const { t } = useTranslation("auth");

  return (
    <main className="auth-shell">
      <header className="auth-header">
        <Link to="/welcome" aria-label={t("homeLink")} className="auth-brand">
          <AppLogo wordmark />
        </Link>
        <div className="auth-header-tools">
          <AuthLanguageSelector />
          <AuthThemeToggle />
        </div>
      </header>

      <section className="auth-content" aria-labelledby="auth-page-title">
        <div className="auth-intro">
          <p className="auth-eyebrow">{t("accountEyebrow")}</p>
          <h1 id="auth-page-title">{title}</h1>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {children}
        {footer ? <div className="auth-secondary">{footer}</div> : null}
        {backLink ? <Link to={backLink.to} className="auth-back-link">← {backLink.label}</Link> : null}
        <AuthLegal />
      </section>

      <aside className="auth-product-scene" aria-label={t("visual.ariaLabel")}>
        <div className="auth-product-grid" aria-hidden="true" />
        <div className="auth-product-copy">
          <span>{t("visual.kicker")}</span>
          <strong>{t("visual.titleLineOne")}<br />{t("visual.titleLineTwo")}</strong>
        </div>
        <div className="auth-day-card">
          <span>{t("visual.day")}</span>
          <strong>8h 00m</strong>
          <small>{t("visual.shift")}</small>
          <b>€164.00</b>
        </div>
        <div className="auth-product-trace" aria-hidden="true" />
        <div className="auth-calendar-fragment">
          <div><span>{t("visual.month")}</span><b>€2,894.00</b></div>
          <div className="auth-calendar-week" aria-hidden="true">
            <span>9</span><span>10</span><span className="is-selected"><i>11</i><small>€164</small></span><span>12</span><span>13</span>
          </div>
          <p>{t("visual.note")}</p>
        </div>
      </aside>
    </main>
  );
}

function AuthLanguageSelector() {
  const { t } = useTranslation("auth");
  const language = normalizeLanguage(i18n.resolvedLanguage);
  return (
    <label className="auth-tool auth-language">
      <Languages aria-hidden="true" />
      <span aria-hidden="true">{language.toUpperCase()}</span>
      <select
        aria-label={t("language")}
        value={language}
        onChange={(event) => {
          const next = normalizeLanguage(event.target.value);
          storeLanguagePreference(next);
          applyAppLanguage(next);
        }}
      >
        {SUPPORTED_LANGUAGES.map((item) => <option key={item} value={item}>{getNativeLanguageName(item)}</option>)}
      </select>
    </label>
  );
}

function AuthThemeToggle() {
  const { t } = useTranslation("auth");
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = window.localStorage.getItem(PUBLIC_THEME_KEY);
    if (saved === "light" || saved === "dark") return saved;
    return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  });

  useLayoutEffect(() => {
    const restore = () => {
      const saved = window.localStorage.getItem(PUBLIC_THEME_KEY);
      const next = saved === "light" || saved === "dark"
        ? saved
        : document.documentElement.dataset.theme === "dark" ? "dark" : "light";
      setTheme(next);
      applyAppTheme(next === "dark" ? "DARK" : "LIGHT");
    };
    const visibility = () => { if (document.visibilityState === "visible") restore(); };
    restore();
    window.addEventListener("pageshow", restore);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("pageshow", restore);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);

  return (
    <button
      type="button"
      className="auth-tool auth-theme"
      aria-label={t(theme === "dark" ? "theme.light" : "theme.dark")}
      onClick={() => {
        const next = theme === "dark" ? "light" : "dark";
        setTheme(next);
        window.localStorage.setItem(PUBLIC_THEME_KEY, next);
        applyAppTheme(next === "dark" ? "DARK" : "LIGHT");
      }}
    >
      {theme === "dark" ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
    </button>
  );
}

function AuthLegal() {
  const { t } = useTranslation("auth");
  return (
    <footer className="auth-legal">
      {t("legal.prefix")} <a href="/terms">{t("legal.terms")}</a> {t("legal.middle")}{" "}
      <a href="/privacy">{t("legal.privacy")}</a>.
    </footer>
  );
}

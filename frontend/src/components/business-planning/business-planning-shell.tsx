import {
  BarChart3,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Languages,
  Moon,
  Settings2,
  Sun,
  MapPinned,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { useLayoutEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { applyAppLanguage, i18n } from "../../i18n";
import {
  getNativeLanguageName,
  normalizeLanguage,
  storeLanguagePreference,
  SUPPORTED_LANGUAGES,
} from "../../i18n/language";
import type { Organization, OrganizationUnit } from "../../types/business";
import { applyAppTheme } from "../../utils/theme";
import { AppLogo } from "../branding/app-logo";

const THEME_KEY = "alveryn.publicTheme";

type Props = {
  organizations: Organization[];
  organizationId: string;
  units: OrganizationUnit[];
  unitId: string;
  weekStart: string;
  weekEnd: string;
  children: ReactNode;
  onOrganizationChange: (organizationId: string) => void;
  onUnitChange: (unitId: string) => void;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onCurrentWeek: () => void;
};

export function BusinessPlanningShell({
  organizations,
  organizationId,
  units,
  unitId,
  weekStart,
  weekEnd,
  children,
  onOrganizationChange,
  onUnitChange,
  onPreviousWeek,
  onNextWeek,
  onCurrentWeek,
}: Props) {
  const { t } = useTranslation("business");
  const navigate = useNavigate();
  const locale = normalizeLanguage(i18n.resolvedLanguage);
  const weekLabel = formatWeek(weekStart, weekEnd, locale);
  const planningSearch = `?unit=${encodeURIComponent(unitId)}&week=${encodeURIComponent(weekStart)}`;

  return (
    <div className="business-planning">
      <div className="business-planning__grid" aria-hidden="true" />
      <header className="business-planning__topbar">
        <Link to="/business" className="business-planning__brand" aria-label="Alveryn Business">
          <AppLogo wordmark />
        </Link>

        <label className="business-planning__workspace-control">
          <span>{t("planning.workspace.label")}</span>
          <select
            aria-label={t("planning.workspace.label")}
            value={`business:${organizationId}`}
            onChange={(event) => {
              if (event.target.value === "personal") navigate("/today");
              else onOrganizationChange(event.target.value.replace("business:", ""));
            }}
          >
            <option value="personal">{t("planning.workspace.personal")}</option>
            {organizations.map((organization) => (
              <option key={organization.id} value={`business:${organization.id}`}>
                {organization.name}
              </option>
            ))}
          </select>
        </label>

        <label className="business-planning__unit-control">
          <span>{t("planning.unit")}</span>
          <select
            aria-label={t("planning.unit")}
            value={unitId}
            onChange={(event) => onUnitChange(event.target.value)}
          >
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>{unit.name}</option>
            ))}
          </select>
        </label>

        <div className="business-planning__week-switcher" aria-label={t("planning.week.label")}>
          <button type="button" onClick={onPreviousWeek} aria-label={t("planning.week.previous")}>
            <ChevronLeft aria-hidden="true" />
          </button>
          <button type="button" onClick={onCurrentWeek} className="business-planning__week-label">
            <span>{t("planning.week.kicker")}</span>
            <strong>{weekLabel}</strong>
          </button>
          <button type="button" onClick={onNextWeek} aria-label={t("planning.week.next")}>
            <ChevronRight aria-hidden="true" />
          </button>
        </div>

        <div className="business-planning__tools">
          <BusinessLanguageSelector />
          <BusinessThemeToggle />
        </div>
      </header>

      <aside className="business-planning__rail" aria-label={t("planning.navigation.label")}>
        <nav>
          <NavLink to={`/business/${organizationId}/plan/demand${planningSearch}`}>
            <ClipboardList aria-hidden="true" />
            <span>{t("planning.navigation.demand")}</span>
          </NavLink>
          <NavLink to={`/business/${organizationId}/plan/schedule${planningSearch}`}>
            <CalendarRange aria-hidden="true" />
            <span>{t("planning.navigation.schedule")}</span>
          </NavLink>
          <NavLink to={`/business/${organizationId}/plan/review${planningSearch}`}>
            <BarChart3 aria-hidden="true" />
            <span>{t("planning.navigation.review")}</span>
          </NavLink>
        </nav>
        <div className="business-planning__rail-secondary">
          <NavLink to={`/business/${organizationId}/people`}>
            <UsersRound aria-hidden="true" />
            <span>{t("planning.navigation.team")}</span>
          </NavLink>
          <NavLink to={`/business/${organizationId}/roles`}>
            <ShieldCheck aria-hidden="true" />
            <span>{t("tabs.roles")}</span>
          </NavLink>
          <NavLink to={`/business/${organizationId}/locations`}>
            <MapPinned aria-hidden="true" />
            <span>{t("tabs.teams")}</span>
          </NavLink>
          <NavLink to={`/business/${organizationId}/work-types`}>
            <Settings2 aria-hidden="true" />
            <span>{t("planning.navigation.workTypes")}</span>
          </NavLink>
        </div>
      </aside>

      <main className="business-planning__main">{children}</main>
    </div>
  );
}

function BusinessLanguageSelector() {
  const { t } = useTranslation("business");
  const language = normalizeLanguage(i18n.resolvedLanguage);
  return (
    <label className="business-planning__tool business-planning__language">
      <Languages aria-hidden="true" />
      <span aria-hidden="true">{language.toUpperCase()}</span>
      <select
        aria-label={t("planning.language")}
        value={language}
        onChange={(event) => {
          const next = normalizeLanguage(event.target.value);
          storeLanguagePreference(next);
          applyAppLanguage(next);
        }}
      >
        {SUPPORTED_LANGUAGES.map((item) => (
          <option key={item} value={item}>{getNativeLanguageName(item)}</option>
        ))}
      </select>
    </label>
  );
}

function BusinessThemeToggle() {
  const { t } = useTranslation("business");
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    document.documentElement.dataset.theme === "dark" ? "dark" : "light",
  );

  useLayoutEffect(() => {
    const restore = () => {
      const saved = window.localStorage.getItem(THEME_KEY);
      const next = saved === "light" || saved === "dark"
        ? saved
        : document.documentElement.dataset.theme === "dark" ? "dark" : "light";
      setTheme(next);
      applyAppTheme(next === "dark" ? "DARK" : "LIGHT");
    };
    const visibility = () => { if (document.visibilityState === "visible") restore(); };
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
      className="business-planning__tool"
      aria-label={t(theme === "dark" ? "planning.theme.light" : "planning.theme.dark")}
      onClick={() => {
        const next = theme === "dark" ? "light" : "dark";
        setTheme(next);
        window.localStorage.setItem(THEME_KEY, next);
        applyAppTheme(next === "dark" ? "DARK" : "LIGHT");
      }}
    >
      {theme === "dark" ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
    </button>
  );
}

function formatWeek(from: string, to: string, locale: string) {
  if (!from || !to) return "";
  const start = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  const formatter = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
  const weekNumber = isoWeekNumber(start);
  return `KW ${weekNumber} · ${formatter.format(start)}–${formatter.format(end)}`;
}

function isoWeekNumber(date: Date) {
  const value = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  value.setUTCDate(value.getUTCDate() + 4 - (value.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
  return Math.ceil((((value.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
}

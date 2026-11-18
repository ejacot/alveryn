import { Languages, Moon, Sun } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useLocation } from "react-router-dom";
import { SUPPORT_EMAIL } from "../api/config";
import { recordMarketingEvent } from "../analytics/marketing-analytics";
import { AppLogo } from "../components/branding/app-logo";
import { ScreenMessage } from "../components/ui/screen-message";
import { useAuth } from "../features/auth/use-auth";
import { applyAppLanguage, i18n } from "../i18n";
import {
  getNativeLanguageName,
  normalizeLanguage,
  storeLanguagePreference,
  SUPPORTED_LANGUAGES,
} from "../i18n/language";
import { APP_HOME_PATH } from "../routes/app-paths";
import { applyAppTheme } from "../utils/theme";
import { WelcomePrecisionStory } from "../features/welcome/welcome-precision-story";

const PUBLIC_THEME_KEY = "alveryn.publicTheme";

export function WelcomePage() {
  const { t } = useTranslation("welcome");
  const { isAuthenticated, isHydrating, user } = useAuth();
  const location = useLocation();
  const isInstalledApp = isStandaloneDisplayMode();
  useStoredPublicTheme();

  useEffect(() => {
    if (!isHydrating && !isAuthenticated && !isInstalledApp) {
      recordMarketingEvent("LANDING_VIEW");
    }
  }, [isAuthenticated, isHydrating, isInstalledApp]);

  if (isHydrating) return <ScreenMessage title={t("loading")} />;
  if (isAuthenticated) {
    return (
      <Navigate
        to={
          user?.preferences?.onboardingCompleted ? APP_HOME_PATH : "/onboarding"
        }
        replace
      />
    );
  }
  if (isInstalledApp && location.pathname === "/")
    return <Navigate to={APP_HOME_PATH} replace />;

  const openStory = () => {
    recordMarketingEvent("DEMO_STARTED");
    document.getElementById("product-story")?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  };

  return (
    <main
      data-testid="welcome-scroll"
      className="welcome-precision-page fixed inset-0 isolate overflow-y-auto overflow-x-hidden overscroll-y-contain"
    >
      <PublicHeader />
      <section className="precision-welcome-hero">
        <div className="precision-hero-layout">
          <div className="precision-hero-copy">
            <h1>{t("motionIntegration.hero.title")}</h1>
            <p>{t("motionIntegration.hero.body")}</p>
            <div className="precision-hero-actions">
              <RegistrationLink className="precision-primary-cta">{t("motionIntegration.cta")}</RegistrationLink>
              <button type="button" onClick={openStory} className="precision-story-link">{t("motionIntegration.hero.storyCta")}</button>
            </div>
          </div>
          <div className="precision-hero-proof" aria-hidden="true">
            {t("motionIntegration.hero.proof")}
            <strong>€164 → €2,894</strong>
          </div>
        </div>
      </section>

      <WelcomePrecisionStory />

      <section id="what-alveryn-records" className="precision-capabilities" aria-labelledby="precision-capabilities-title">
        <div className="precision-capabilities-inner">
          <h2 id="precision-capabilities-title">{t("motionIntegration.capabilities.title")}</h2>
          <div className="precision-capability-list">
            {(t("motionIntegration.capabilities.items", { returnObjects: true }) as string[]).map((item) => <span key={item}>{item}</span>)}
          </div>
        </div>
      </section>

      <section className="precision-final">
        <div className="precision-final-inner">
          <div><h2>{t("motionIntegration.final.title")}</h2><p>{t("motionIntegration.final.body")}</p></div>
          <RegistrationLink className="precision-primary-cta">{t("motionIntegration.cta")}</RegistrationLink>
        </div>
      </section>
      <footer className="welcome-precision-footer"><div><AppLogo wordmark /><span>© {new Date().getFullYear()} Alveryn · {SUPPORT_EMAIL}</span></div></footer>
    </main>
  );
}

export function PublicHeader({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation("welcome");
  return (
    <header className="public-header sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 pt-[env(safe-area-inset-top)] backdrop-blur-2xl">
      <nav
        aria-label={t("nav.aria")}
        className="mx-auto flex h-14 max-w-[86rem] items-center justify-between gap-2 px-4 sm:h-16 sm:px-8 lg:px-12"
      >
        <Link to="/welcome" aria-label="Alveryn">
          <AppLogo />
        </Link>
        {!compact ? (
          <div className="public-header-links hidden items-center gap-7 text-sm font-medium text-slate-500 md:flex">
            <a href="#product-story" className="hover:text-slate-950">
              {t("interactive.nav.demo")}
            </a>
            <a href="#what-alveryn-records" className="hover:text-slate-950">
              {t("interactive.nav.why")}
            </a>
          </div>
        ) : null}
        <div className="flex items-center gap-1.5">
          <LanguageSelector />
          <span className="hidden sm:inline-flex">
            <ThemeToggle />
          </span>
          <Link
            to="/login"
            className="public-header-login hidden px-3 text-sm font-semibold text-slate-600 sm:inline"
          >
            {t("nav.login")}
          </Link>
          <RegistrationLink className="public-header-cta rounded-full bg-slate-950 px-4 py-2.5 text-xs font-semibold !text-white sm:text-sm">
            {t("interactive.hero.accountCta")}
          </RegistrationLink>
        </div>
      </nav>
    </header>
  );
}

export function PublicFooter() {
  const { t } = useTranslation("welcome");
  return (
    <footer className="welcome-light-section border-t border-slate-200 bg-white text-slate-950">
      <div className="mx-auto grid max-w-[86rem] gap-8 px-5 py-10 sm:grid-cols-[1fr_auto] sm:px-8 lg:px-12">
        <div>
          <AppLogo wordmark className="justify-start" />
          <p className="mt-4 max-w-md text-sm leading-6 text-slate-500">
            {t("footer.description")}
          </p>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="mt-3 inline-block text-sm text-emerald-700"
          >
            {SUPPORT_EMAIL}
          </a>
        </div>
        <div className="flex flex-wrap items-center gap-5 text-sm text-slate-600">
          <a href="/welcome#live-demo">{t("interactive.nav.demo")}</a>
          <Link to="/login">{t("nav.login")}</Link>
          <RegistrationLink>
            {t("interactive.hero.accountCta")}
          </RegistrationLink>
          <LanguageSelector />
        </div>
        <p className="text-xs text-slate-400 sm:col-span-2">
          © {new Date().getFullYear()} Alveryn
        </p>
      </div>
    </footer>
  );
}

export function RegistrationLink({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      to="/register"
      onClick={() => recordMarketingEvent("REGISTRATION_STARTED")}
      className={className}
    >
      {children}
    </Link>
  );
}

function LanguageSelector() {
  const { t } = useTranslation("welcome");
  return (
    <label className="relative inline-flex min-h-10 items-center gap-1 rounded-full border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-600">
      <Languages className="h-3.5 w-3.5" />
      <span aria-hidden="true">
        {normalizeLanguage(i18n.resolvedLanguage).toUpperCase()}
      </span>
      <select
        aria-label={t("nav.language")}
        value={normalizeLanguage(i18n.resolvedLanguage)}
        onChange={(event) => {
          const language = normalizeLanguage(event.target.value);
          storeLanguagePreference(language);
          applyAppLanguage(language);
        }}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {SUPPORTED_LANGUAGES.map((language) => (
          <option key={language} value={language}>
            {getNativeLanguageName(language)}
          </option>
        ))}
      </select>
    </label>
  );
}

function ThemeToggle() {
  const { t } = useTranslation("welcome");
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = window.localStorage.getItem(PUBLIC_THEME_KEY);
    if (saved === "light" || saved === "dark") return saved;
    return document.documentElement.dataset.theme === "light"
      ? "light"
      : "dark";
  });
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    window.localStorage.setItem(PUBLIC_THEME_KEY, next);
    applyAppTheme(next === "dark" ? "DARK" : "LIGHT");
  };
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t(theme === "dark" ? "theme.light" : "theme.dark")}
      className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
    >
      {theme === "dark" ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </button>
  );
}

export function useStoredPublicTheme() {
  useEffect(() => {
    const media =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-color-scheme: dark)")
        : ({
            matches: false,
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
          } as Pick<MediaQueryList, "matches" | "addEventListener" | "removeEventListener">);
    const applyResolvedTheme = () => {
      const saved = window.localStorage.getItem(PUBLIC_THEME_KEY);
      const followsSystem =
        typeof window.matchMedia === "function"
          ? window.matchMedia("(max-width: 639px)").matches
          : false;
      const dark = followsSystem
        ? media.matches
        : saved === "dark" || (saved !== "light" && media.matches);
      applyAppTheme(dark ? "DARK" : "LIGHT");
      document.documentElement.dataset.welcomeMotion = "settled";
      window.dispatchEvent(new Event("welcome-motion-settle"));
    };
    const restore = () => {
      if (document.visibilityState === "visible") {
        requestAnimationFrame(applyResolvedTheme);
      }
    };
    applyResolvedTheme();
    media.addEventListener("change", applyResolvedTheme);
    document.addEventListener("visibilitychange", restore);
    window.addEventListener("pageshow", applyResolvedTheme);
    return () => {
      media.removeEventListener("change", applyResolvedTheme);
      document.removeEventListener("visibilitychange", restore);
      window.removeEventListener("pageshow", applyResolvedTheme);
    };
  }, []);
}

export function DashboardCardImage({
  name,
  alt,
  priority = false,
  className = "",
}: {
  name: "day" | "activity" | "flow" | "rhythm";
  alt?: string;
  priority?: boolean;
  className?: string;
}) {
  const dimensions =
    name === "activity" ? [530, 294] : name === "day" ? [530, 258] : [530, 566];
  return (
    <ThemedImage
      base={`/landing/dashboard/${name}`}
      alt={alt}
      priority={priority}
      width={dimensions[0]}
      height={dimensions[1]}
      className={className}
    />
  );
}
export function StatisticsCardImage({
  name,
  alt,
}: {
  name: "filters" | "trend" | "kpis" | "compare" | "selected";
  alt?: string;
}) {
  const dimensions =
    name === "filters"
      ? [530, 540]
      : name === "trend"
        ? [530, 600]
        : name === "kpis"
          ? [530, 340]
          : [530, 873];
  return (
    <ThemedImage
      base={`/landing/statistics-tour/${name}`}
      alt={alt}
      width={dimensions[0]}
      height={dimensions[1]}
    />
  );
}
export function CalendarCardImage({
  name,
  alt,
}: {
  name: "month" | "summary" | "payroll" | "flow" | "rhythm" | "tools";
  alt?: string;
}) {
  const dimensions =
    name === "month"
      ? [530, 580]
      : name === "summary"
        ? [530, 835]
        : name === "payroll"
          ? [530, 790]
          : name === "tools"
            ? [530, 255]
            : [530, 425];
  return (
    <ThemedImage
      base={`/landing/calendar/${name}`}
      alt={alt}
      width={dimensions[0]}
      height={dimensions[1]}
    />
  );
}

function ThemedImage({
  base,
  alt = "",
  priority = false,
  width,
  height,
  className = "",
}: {
  base: string;
  alt?: string;
  priority?: boolean;
  width: number;
  height: number;
  className?: string;
}) {
  const common = `h-auto w-full ${className}`;
  return (
    <div className="overflow-hidden rounded-[20px] border border-white/[0.08] bg-black">
      <img
        src={`${base}-dark.jpg`}
        alt={alt}
        width={width}
        height={height}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        className={`landing-theme-dark block ${common}`}
      />
      <img
        src={`${base}-light.jpg`}
        alt={alt}
        width={width}
        height={height}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        className={`landing-theme-light hidden ${common}`}
      />
    </div>
  );
}

function isStandaloneDisplayMode() {
  if (typeof window === "undefined") return false;
  const iosNavigator = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    iosNavigator.standalone === true
  );
}

import {
  ArrowRight,
  Check,
  Languages,
  Sparkles
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useLocation } from "react-router-dom";
import { recordMarketingEvent } from "../analytics/marketing-analytics";
import { AppLogo } from "../components/branding/app-logo";
import { ScreenMessage } from "../components/ui/screen-message";
import { useAuth } from "../features/auth/use-auth";
import { APP_HOME_PATH } from "../routes/app-paths";
import { applyAppLanguage, i18n } from "../i18n";
import {
  getNativeLanguageName,
  normalizeLanguage,
  storeLanguagePreference,
  SUPPORTED_LANGUAGES
} from "../i18n/language";

export function WelcomePage() {
  const { t } = useTranslation("welcome");
  const { isAuthenticated, isHydrating, user } = useAuth();
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  const heroPoints = t("hero.points", { returnObjects: true }) as string[];
  const isInstalledApp = isStandaloneDisplayMode();

  useEffect(() => {
    if (!isHydrating && !isAuthenticated && !isInstalledApp) {
      recordMarketingEvent("LANDING_VIEW");
    }
  }, [isAuthenticated, isHydrating, isInstalledApp]);

  if (isHydrating) {
    return <ScreenMessage title={t("loading")} />;
  }

  if (isAuthenticated) {
    return <Navigate to={user?.preferences?.onboardingCompleted ? APP_HOME_PATH : "/onboarding"} replace />;
  }

  if (isInstalledApp && location.pathname === "/") {
    return <Navigate to={APP_HOME_PATH} replace />;
  }

  return (
    <main
      data-testid="welcome-scroll"
      className="landing-page fixed inset-0 isolate overflow-y-auto overflow-x-hidden overscroll-y-contain bg-black text-white"
    >
      <div
        className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[48rem] bg-[radial-gradient(circle_at_72%_8%,rgba(16,185,129,0.16),transparent_34%),radial-gradient(circle_at_18%_18%,rgba(255,255,255,0.08),transparent_28%)]"
        aria-hidden="true"
      />

      <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-black/80 pt-[env(safe-area-inset-top)] backdrop-blur-2xl">
        <nav className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-2 px-4 sm:h-16 sm:gap-4 sm:px-8 lg:px-10">
          <AppLogo className="justify-start" />
          <div className="hidden items-center gap-7 text-sm font-medium text-white/58 md:flex">
            <a href="#product-tour" className="transition hover:text-white">{t("nav.product")}</a>
            <a href="#how-it-works" className="transition hover:text-white">{t("nav.how")}</a>
            <a href="#for-who" className="transition hover:text-white">{t("nav.forWho")}</a>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <label className="relative inline-flex min-h-10 items-center gap-1 rounded-full border border-white/[0.1] bg-white/[0.04] px-2 text-xs font-semibold text-white/68 transition focus-within:ring-2 focus-within:ring-emerald-300/40 hover:text-white sm:px-3">
              <Languages className="h-3.5 w-3.5" aria-hidden="true" />
              <span aria-hidden="true">{normalizeLanguage(i18n.resolvedLanguage).toUpperCase()}</span>
              <span className="sr-only">{t("nav.language")}</span>
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
            <Link
              to="/login"
              className="hidden min-h-10 items-center justify-center rounded-full px-3 text-sm font-semibold text-white/68 transition hover:text-white focus:outline-none focus:ring-2 focus:ring-white/30 sm:inline-flex sm:px-4"
            >
              {t("nav.login")}
            </Link>
            <Link
              to="/register"
              onClick={() => recordMarketingEvent("REGISTRATION_STARTED")}
              className="inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-full bg-white px-4 text-xs font-semibold text-black transition hover:bg-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-300/60 sm:px-5 sm:text-sm"
            >
              <span className="sm:hidden">{t("nav.registerShort")}</span>
              <span className="hidden sm:inline">{t("nav.register")}</span>
            </Link>
          </div>
        </nav>
      </header>

      <section id="product" className="mx-auto grid min-h-[calc(100dvh-4rem)] w-full max-w-7xl gap-12 px-5 py-8 sm:px-8 sm:py-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-10 lg:py-20">
        <div className="space-y-7">
          <p className="landing-hero-badge inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/[0.08] px-4 py-2 text-sm font-medium text-emerald-200">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            {t("hero.eyebrow")}
          </p>
          <div className="space-y-5">
            <h1 className="max-w-4xl text-balance text-[2.85rem] font-semibold leading-[0.98] tracking-[-0.035em] text-white sm:text-6xl lg:text-[4.25rem]">
              {t("hero.title")}
            </h1>
            <p className="max-w-xl text-lg leading-8 text-white/64 sm:text-xl">{t("hero.subtitle")}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              to="/register"
              onClick={() => recordMarketingEvent("REGISTRATION_STARTED")}
              className="inline-flex min-h-[3.25rem] items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-black shadow-[0_20px_70px_rgba(255,255,255,0.12)] transition hover:bg-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-300/60"
            >
              {t("hero.primaryCta")}
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Link>
            <a
              href="#product-tour"
              className="inline-flex min-h-[3.25rem] items-center justify-center rounded-full border border-white/[0.14] bg-white/[0.055] px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.1] focus:outline-none focus:ring-2 focus:ring-white/30"
            >
              {t("hero.secondaryCta")}
            </a>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1">
            {heroPoints.map((point) => (
              <span key={point} className="inline-flex items-center gap-2 text-sm text-white/58">
                <Check className="h-4 w-4 text-[#34d399]" aria-hidden="true" />
                {point}
              </span>
            ))}
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[680px]">
          <div className="absolute inset-12 rounded-full bg-emerald-400/15 blur-3xl" aria-hidden="true" />
          <DashboardPreview t={t} />
        </div>
      </section>

      <div className="border-y border-white/[0.07] bg-white/[0.025]">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-2 gap-px px-5 sm:grid-cols-4 sm:px-8 lg:px-10">
          {(["time", "unit", "fixed", "absence"] as const).map((key) => (
            <div key={key} className="flex min-h-24 items-center justify-center border-white/[0.07] px-3 text-center text-sm font-semibold text-white/56 sm:border-x">
              {t(`formats.${key}`)}
            </div>
          ))}
        </div>
      </div>

      <LandingSection id="product-tour" reduceMotion={reduceMotion}>
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-500">{t("marketingTour.eyebrow")}</p>
          <h2 className="mt-5 text-balance text-4xl font-semibold tracking-[-0.03em] text-white sm:text-5xl">{t("marketingTour.title")}</h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-white/56 sm:text-lg">{t("marketingTour.body")}</p>
        </div>
        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {(["dashboard", "calendar", "statistics"] as const).map((product) => (
            <Link key={product} to={`/welcome/${product}`} className="group overflow-hidden rounded-[30px] border border-white/[0.09] bg-white/[0.035] transition hover:-translate-y-1 hover:border-emerald-400/25">
              <div className="p-3">
                {product === "dashboard" ? <DashboardCardImage name="day" /> : null}
                {product === "calendar" ? <CalendarCardImage name="month" /> : null}
                {product === "statistics" ? <StatisticsCardImage name="trend" /> : null}
              </div>
              <div className="border-t border-white/[0.08] px-5 py-5">
                <h3 className="flex items-center justify-between text-xl font-semibold capitalize text-white">{t(`marketingTour.${product}.title`)}<ArrowRight className="h-4 w-4 text-emerald-500 transition group-hover:translate-x-1" /></h3>
                <p className="mt-2 text-sm leading-6 text-white/52">{t(`marketingTour.${product}.body`)}</p>
              </div>
            </Link>
          ))}
        </div>
      </LandingSection>

      <LandingSection id="for-who" reduceMotion={reduceMotion} className="border-y border-white/[0.07] bg-emerald-400/[0.025]">
        <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <PayslipPreview t={t} />
          <ProductChapter t={t} section="lohn" number="04" />
        </div>
      </LandingSection>

      <LandingSection reduceMotion={reduceMotion} className="pb-20">
        <div className="relative overflow-hidden rounded-[38px] border border-white/[0.1] bg-white/[0.055] px-6 py-14 text-center sm:px-12 sm:py-16">
          <div className="pointer-events-none absolute inset-x-1/4 -top-32 h-64 rounded-full bg-emerald-400/15 blur-3xl" aria-hidden="true" />
          <h2 className="relative mx-auto max-w-3xl text-balance text-4xl font-semibold leading-tight tracking-[-0.025em] text-white sm:text-5xl">
            {t("final.title")}
          </h2>
          <p className="relative mx-auto mt-5 max-w-2xl text-base leading-7 text-white/58 sm:text-lg">{t("final.subtitle")}</p>
          <div className="relative mx-auto mt-8 grid max-w-3xl gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((index) => (
              <div key={index} className="rounded-[20px] border border-white/[0.09] bg-white/[0.04] px-4 py-4 text-sm font-semibold text-white/70">
                <Check className="mx-auto mb-2 h-4 w-4 text-emerald-500" aria-hidden="true" />
                {t(`final.points.${index}`)}
              </div>
            ))}
          </div>
          <Link
            to="/register"
            onClick={() => recordMarketingEvent("REGISTRATION_STARTED")}
            className="relative mt-8 inline-flex min-h-[3.25rem] items-center justify-center rounded-full bg-white px-7 py-3 text-sm font-semibold text-black transition hover:bg-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-300/60"
          >
            {t("final.primaryCta")}
            <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </LandingSection>
    </main>
  );
}

function ProductChapter({ t, section, number }: { t: (key: string) => string; section: string; number: string }) {
  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-500">
        <span>{number}</span><span className="h-px w-8 bg-emerald-500/50" />{t(`tour.${section}.eyebrow`)}
      </div>
      <h2 className="mt-5 text-balance text-4xl font-semibold leading-[1.04] tracking-[-0.03em] text-white sm:text-5xl">{t(`tour.${section}.title`)}</h2>
      <p className="mt-5 text-base leading-7 text-white/56 sm:text-lg">{t(`tour.${section}.body`)}</p>
      <div className="mt-7 flex flex-wrap gap-2">
        {[0, 1, 2].map((index) => (
          <span key={index} className="rounded-full border border-white/[0.1] bg-white/[0.045] px-3.5 py-2 text-xs font-semibold text-white/65">
            {t(`tour.${section}.points.${index}`)}
          </span>
        ))}
      </div>
    </div>
  );
}

function DashboardPreview({ t }: { t: (key: string) => string }) {
  return (
    <div
      role="img"
      aria-label={t("preview.dashboardAlt")}
      className="relative rounded-[34px] border border-white/[0.12] bg-[#070b09] p-3 shadow-[0_35px_120px_rgba(0,0,0,0.62)] sm:p-4"
    >
      <div className="grid gap-3 overflow-hidden rounded-[26px] sm:grid-cols-2">
        <div className="space-y-3"><DashboardCardImage name="day" /><DashboardCardImage name="activity" /></div>
        <DashboardCardImage name="flow" className="h-full object-cover object-top" />
      </div>
    </div>
  );
}

export function DashboardCardImage({ name, className = "" }: { name: "day" | "activity" | "flow" | "rhythm"; className?: string }) {
  return (
    <div className="overflow-hidden rounded-[20px] border border-white/[0.08] bg-black">
      <img src={`/landing/dashboard/${name}-dark.jpg`} alt="" loading="lazy" decoding="async" className={`landing-theme-dark block h-auto w-full ${className}`} />
      <img src={`/landing/dashboard/${name}-light.jpg`} alt="" loading="lazy" decoding="async" className={`landing-theme-light hidden h-auto w-full ${className}`} />
    </div>
  );
}

export function StatisticsCardImage({ name }: { name: "filters" | "trend" | "kpis" | "compare" | "selected" }) {
  return (
    <div className="overflow-hidden rounded-[20px] border border-white/[0.08] bg-black">
      <img src={`/landing/statistics-tour/${name}-dark.jpg`} alt="" loading="lazy" decoding="async" className="landing-theme-dark block h-auto w-full" />
      <img src={`/landing/statistics-tour/${name}-light.jpg`} alt="" loading="lazy" decoding="async" className="landing-theme-light hidden h-auto w-full" />
    </div>
  );
}

export function CalendarCardImage({ name }: { name: "month" | "summary" | "payroll" | "flow" | "rhythm" | "tools" }) {
  return (
    <div className="overflow-hidden rounded-[20px] border border-white/[0.08] bg-black">
      <img src={`/landing/calendar/${name}-dark.jpg`} alt="" loading="lazy" decoding="async" className="landing-theme-dark block h-auto w-full" />
      <img src={`/landing/calendar/${name}-light.jpg`} alt="" loading="lazy" decoding="async" className="landing-theme-light hidden h-auto w-full" />
    </div>
  );
}

function PayslipPreview({ t }: { t: (key: string) => string }) {
  const rows = [
    [t("payslip.hours"), "168h", "160h", "+8h"],
    [t("payslip.gross"), "€3,850.00", "€3,640.00", "+€210.00"],
    [t("payslip.workedDays"), "23", "22", "+1"]
  ];

  return (
    <div
      role="img"
      aria-label={t("payslip.alt")}
      className="overflow-hidden rounded-[32px] border border-white/[0.1] bg-[#070b09] shadow-[0_28px_90px_rgba(0,0,0,0.4)]"
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.1] px-5 py-5 sm:px-7">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-white/40">{t("payslip.document")}</p>
          <p className="mt-2 text-xl font-semibold text-white">{t("payslip.comparisonTitle")}</p>
        </div>
        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-500">{t("payslip.resultLabel")}</span>
      </div>
      <div className="grid grid-cols-[1.1fr_1fr_1fr_0.9fr] border-b border-white/[0.1] px-5 py-3 text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-white/38 sm:px-7">
        <span>{t("payslip.item")}</span><span>Alveryn</span><span>Lohn</span><span className="text-right">{t("payslip.difference")}</span>
      </div>
      {rows.map(([label, alveryn, lohn, difference]) => (
        <div key={label} className="grid grid-cols-[1.1fr_1fr_1fr_0.9fr] items-center border-b border-white/[0.07] px-5 py-4 text-xs sm:px-7 sm:text-sm">
          <span className="text-white/52">{label}</span><strong className="text-white">{alveryn}</strong><strong className="text-white">{lohn}</strong><strong className="text-right text-emerald-500">{difference}</strong>
        </div>
      ))}
      <div className="grid grid-cols-3 gap-px bg-white/[0.08]">
        {[[t("payslip.net"), "€2,487.16"], [t("payslip.tax"), "€512.84"], [t("payslip.social"), "€640.00"]].map(([label, value]) => (
          <div key={label} className="bg-[#070b09] px-2 py-5 text-center">
            <p className="text-[0.58rem] font-semibold uppercase tracking-[0.06em] text-white/38">{label}</p>
            <p className="mt-2 text-sm font-semibold text-white sm:text-base">{value}</p>
          </div>
        ))}
      </div>
      <p className="px-5 py-4 text-center text-xs leading-5 text-white/34 sm:px-7">{t("payslip.disclaimer")}</p>
    </div>
  );
}

function isStandaloneDisplayMode() {
  if (typeof window === "undefined") {
    return false;
  }

  const iosNavigator = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.("(display-mode: standalone)").matches === true || iosNavigator.standalone === true;
}

function LandingSection({
  id,
  children,
  className = "",
  reduceMotion
}: {
  id?: string;
  children: React.ReactNode;
  className?: string;
  reduceMotion: boolean | null;
}) {
  return (
    <motion.section
      id={id}
      initial={reduceMotion ? false : { opacity: 0, y: 24 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={className}
    >
      <div className="mx-auto w-full max-w-7xl px-5 py-16 sm:px-8 lg:px-10 lg:py-24">{children}</div>
    </motion.section>
  );
}

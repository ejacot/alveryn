import {
  ArrowRight,
  Banknote,
  BarChart3,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  Clock3,
  Layers3,
  Languages,
  Sparkles,
  TimerReset
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

type TextItem = {
  title: string;
  description: string;
};

const capabilityIcons = [Clock3, Banknote, BarChart3];
const audienceIcons = [BriefcaseBusiness, Layers3, TimerReset];

export function WelcomePage() {
  const { t } = useTranslation("welcome");
  const { isAuthenticated, isHydrating, user } = useAuth();
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  const heroPoints = t("hero.points", { returnObjects: true }) as string[];
  const capabilities = t("capabilities.items", { returnObjects: true }) as TextItem[];
  const workflowSteps = t("workflow.steps", { returnObjects: true }) as TextItem[];
  const audiences = t("audience.items", { returnObjects: true }) as TextItem[];
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
        <nav className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-5 sm:px-8 lg:px-10">
          <AppLogo className="justify-start" />
          <div className="hidden items-center gap-7 text-sm font-medium text-white/58 md:flex">
            <a href="#product" className="transition hover:text-white">{t("nav.product")}</a>
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
              className="inline-flex min-h-10 items-center justify-center rounded-full px-3 text-sm font-semibold text-white/68 transition hover:text-white focus:outline-none focus:ring-2 focus:ring-white/30 sm:px-4"
            >
              {t("nav.login")}
            </Link>
            <Link
              to="/register"
              onClick={() => recordMarketingEvent("REGISTRATION_STARTED")}
              className="inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-full bg-white px-3.5 text-xs font-semibold text-black transition hover:bg-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-300/60 sm:px-5 sm:text-sm"
            >
              {t("nav.register")}
            </Link>
          </div>
        </nav>
      </header>

      <section className="mx-auto grid min-h-[calc(100dvh-4rem)] w-full max-w-7xl gap-12 px-5 py-12 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-10 lg:py-20">
        <div className="space-y-7">
          <p className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/[0.08] px-4 py-2 text-sm font-medium text-emerald-200">
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
              href="#product"
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

      <LandingSection id="product" reduceMotion={reduceMotion}>
        <SectionIntro
          eyebrow={t("capabilities.eyebrow")}
          title={t("capabilities.title")}
          body={t("capabilities.body")}
          centered
        />
        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {capabilities.map((item, index) => {
            const Icon = capabilityIcons[index] ?? CheckCircle2;
            return (
              <article key={item.title} className="rounded-[30px] border border-white/[0.08] bg-white/[0.04] p-6 sm:p-7">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-300/10 text-emerald-300">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-7 text-xl font-semibold text-white">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-white/56">{item.description}</p>
              </article>
            );
          })}
        </div>
      </LandingSection>

      <LandingSection reduceMotion={reduceMotion} className="border-b border-white/[0.07] bg-emerald-400/[0.025]">
        <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <SectionIntro eyebrow={t("payslip.eyebrow")} title={t("payslip.title")} body={t("payslip.body")} />
          <PayslipPreview t={t} />
        </div>
      </LandingSection>

      <LandingSection id="how-it-works" reduceMotion={reduceMotion} className="border-y border-white/[0.07] bg-white/[0.025]">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div>
            <SectionIntro eyebrow={t("workflow.eyebrow")} title={t("workflow.title")} body={t("workflow.body")} />
            <div className="mt-9 space-y-7">
              {workflowSteps.map((step, index) => (
                <div key={step.title} className="grid grid-cols-[auto_1fr] gap-4">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.07] text-xs font-semibold text-white">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="font-semibold text-white">{step.title}</h3>
                    <p className="mt-1.5 text-sm leading-6 text-white/54">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <MonthPreview t={t} />
        </div>
      </LandingSection>

      <LandingSection id="for-who" reduceMotion={reduceMotion}>
        <div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:items-start">
          <SectionIntro eyebrow={t("audience.eyebrow")} title={t("audience.title")} body={t("audience.body")} />
          <div className="grid gap-4 sm:grid-cols-3">
            {audiences.map((item, index) => {
              const Icon = audienceIcons[index] ?? BriefcaseBusiness;
              return (
                <article key={item.title} className="rounded-[28px] border border-white/[0.08] bg-white/[0.04] p-5">
                  <Icon className="h-5 w-5 text-[#34d399]" aria-hidden="true" />
                  <h3 className="mt-6 font-semibold text-white">{item.title}</h3>
                  <p className="mt-2.5 text-sm leading-6 text-white/54">{item.description}</p>
                </article>
              );
            })}
          </div>
        </div>
      </LandingSection>

      <LandingSection reduceMotion={reduceMotion} className="pb-20">
        <div className="relative overflow-hidden rounded-[38px] border border-white/[0.1] bg-white/[0.055] px-6 py-14 text-center sm:px-12 sm:py-16">
          <div className="pointer-events-none absolute inset-x-1/4 -top-32 h-64 rounded-full bg-emerald-400/15 blur-3xl" aria-hidden="true" />
          <h2 className="relative mx-auto max-w-3xl text-balance text-4xl font-semibold leading-tight tracking-[-0.025em] text-white sm:text-5xl">
            {t("final.title")}
          </h2>
          <p className="relative mx-auto mt-5 max-w-2xl text-base leading-7 text-white/58 sm:text-lg">{t("final.subtitle")}</p>
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

function DashboardPreview({ t }: { t: (key: string) => string }) {
  return (
    <div
      role="img"
      aria-label={t("preview.dashboardAlt")}
      className="relative rounded-[34px] border border-white/[0.12] bg-[#070b09] p-3 shadow-[0_35px_120px_rgba(0,0,0,0.62)] sm:p-4"
    >
      <div className="space-y-3 overflow-hidden rounded-[26px]">
        <img src="/landing/today-summary.webp" alt="" className="block h-auto w-full rounded-[22px]" />
        <img src="/landing/activity-detail.webp" alt="" className="block h-auto w-full rounded-[22px]" />
      </div>
    </div>
  );
}

function MonthPreview({ t }: { t: (key: string) => string }) {
  return (
    <div
      role="img"
      aria-label={t("monthPreview.alt")}
      className="grid gap-3 rounded-[32px] border border-white/[0.1] bg-[#070b09] p-3 shadow-[0_28px_90px_rgba(0,0,0,0.4)] sm:grid-cols-[1.15fr_0.85fr] sm:p-4"
    >
      <img src="/landing/monthly-summary.webp" alt="" className="block h-full w-full rounded-[22px] object-cover object-top" />
      <img src="/landing/month-in-motion.webp" alt="" className="block h-full w-full rounded-[22px] object-cover" />
    </div>
  );
}

function PayslipPreview({ t }: { t: (key: string) => string }) {
  return (
    <div
      role="img"
      aria-label={t("payslip.alt")}
      className="rounded-[32px] border border-white/[0.1] bg-[#070b09] p-3 shadow-[0_28px_90px_rgba(0,0,0,0.4)] sm:p-4"
    >
      <img src="/landing/payslip-match.webp" alt="" className="block h-auto w-full rounded-[24px]" />
      <p className="mt-4 text-center text-xs leading-5 text-white/34">{t("payslip.disclaimer")}</p>
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

function SectionIntro({
  eyebrow,
  title,
  body,
  centered = false
}: {
  eyebrow: string;
  title: string;
  body: string;
  centered?: boolean;
}) {
  return (
    <div className={`max-w-3xl space-y-4 ${centered ? "mx-auto text-center" : ""}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#34d399]/80">{eyebrow}</p>
      <h2 className="text-balance text-3xl font-semibold leading-tight tracking-[-0.025em] text-white sm:text-5xl">{title}</h2>
      <p className="text-base leading-7 text-white/58 sm:text-lg">{body}</p>
    </div>
  );
}

import {
  ArrowRight,
  Banknote,
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Layers3,
  Palmtree,
  Sparkles,
  TimerReset
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate } from "react-router-dom";
import { recordMarketingEvent } from "../analytics/marketing-analytics";
import { AppLogo } from "../components/branding/app-logo";
import { ScreenMessage } from "../components/ui/screen-message";
import { useAuth } from "../features/auth/use-auth";
import { APP_HOME_PATH } from "../routes/app-paths";

type TextItem = {
  title: string;
  description: string;
};

type PreviewActivity = {
  name: string;
  detail: string;
  value: string;
};

const capabilityIcons = [Clock3, Banknote, BarChart3];
const audienceIcons = [BriefcaseBusiness, Layers3, TimerReset];

export function WelcomePage() {
  const { t } = useTranslation("welcome");
  const { isAuthenticated, isHydrating, user } = useAuth();
  const reduceMotion = useReducedMotion();
  const heroPoints = t("hero.points", { returnObjects: true }) as string[];
  const capabilities = t("capabilities.items", { returnObjects: true }) as TextItem[];
  const workflowSteps = t("workflow.steps", { returnObjects: true }) as TextItem[];
  const audiences = t("audience.items", { returnObjects: true }) as TextItem[];
  const activityItems = t("preview.activities", { returnObjects: true }) as PreviewActivity[];
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

  if (isInstalledApp) {
    return <Navigate to={APP_HOME_PATH} replace />;
  }

  return (
    <main
      data-testid="welcome-scroll"
      className="landing-page fixed inset-0 isolate overflow-y-auto overflow-x-hidden overscroll-y-contain bg-black text-white"
    >
      <div
        className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[48rem] bg-[radial-gradient(circle_at_72%_8%,rgba(244,201,93,0.16),transparent_34%),radial-gradient(circle_at_18%_18%,rgba(255,255,255,0.08),transparent_28%)]"
        aria-hidden="true"
      />

      <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-black/80 backdrop-blur-2xl">
        <nav className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-5 sm:px-8 lg:px-10">
          <AppLogo className="justify-start" />
          <div className="hidden items-center gap-7 text-sm font-medium text-white/58 md:flex">
            <a href="#product" className="transition hover:text-white">{t("nav.product")}</a>
            <a href="#how-it-works" className="transition hover:text-white">{t("nav.how")}</a>
            <a href="#for-who" className="transition hover:text-white">{t("nav.forWho")}</a>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Link
              to="/login"
              className="inline-flex min-h-10 items-center justify-center rounded-full px-3 text-sm font-semibold text-white/68 transition hover:text-white focus:outline-none focus:ring-2 focus:ring-white/30 sm:px-4"
            >
              {t("nav.login")}
            </Link>
            <Link
              to="/register"
              onClick={() => recordMarketingEvent("REGISTRATION_STARTED")}
              className="inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-full bg-white px-3.5 text-xs font-semibold text-black transition hover:bg-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-300/60 sm:px-5 sm:text-sm"
            >
              {t("nav.register")}
            </Link>
          </div>
        </nav>
      </header>

      <section className="mx-auto grid min-h-[calc(100dvh-4rem)] w-full max-w-7xl gap-12 px-5 py-12 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-10 lg:py-20">
        <div className="space-y-7">
          <p className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/[0.08] px-4 py-2 text-sm font-medium text-amber-200">
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
              className="inline-flex min-h-[3.25rem] items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-black shadow-[0_20px_70px_rgba(255,255,255,0.12)] transition hover:bg-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-300/60"
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
                <Check className="h-4 w-4 text-[#f4c95d]" aria-hidden="true" />
                {point}
              </span>
            ))}
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[680px]">
          <div className="absolute inset-12 rounded-full bg-amber-300/15 blur-3xl" aria-hidden="true" />
          <DashboardPreview t={t} activities={activityItems} />
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
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-300/20 bg-amber-300/10 text-amber-300">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-7 text-xl font-semibold text-white">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-white/56">{item.description}</p>
              </article>
            );
          })}
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
                  <Icon className="h-5 w-5 text-[#f4c95d]" aria-hidden="true" />
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
          <div className="pointer-events-none absolute inset-x-1/4 -top-32 h-64 rounded-full bg-amber-300/15 blur-3xl" aria-hidden="true" />
          <h2 className="relative mx-auto max-w-3xl text-balance text-4xl font-semibold leading-tight tracking-[-0.025em] text-white sm:text-5xl">
            {t("final.title")}
          </h2>
          <p className="relative mx-auto mt-5 max-w-2xl text-base leading-7 text-white/58 sm:text-lg">{t("final.subtitle")}</p>
          <Link
            to="/register"
            onClick={() => recordMarketingEvent("REGISTRATION_STARTED")}
            className="relative mt-8 inline-flex min-h-[3.25rem] items-center justify-center rounded-full bg-white px-7 py-3 text-sm font-semibold text-black transition hover:bg-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-300/60"
          >
            {t("final.primaryCta")}
            <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </LandingSection>
    </main>
  );
}

function DashboardPreview({ t, activities }: { t: (key: string) => string; activities: PreviewActivity[] }) {
  return (
    <div
      role="img"
      aria-label={t("preview.dashboardAlt")}
      className="relative overflow-hidden rounded-[34px] border border-white/[0.12] bg-black p-3 shadow-[0_35px_120px_rgba(0,0,0,0.62)] sm:p-4"
    >
      <div className="rounded-[26px] border border-white/[0.07] bg-black p-4 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-white/38">{t("preview.today")}</p>
            <h2 className="mt-1 text-xl font-semibold text-white sm:text-2xl">{t("preview.greeting")}</h2>
          </div>
          <span className="rounded-full border border-emerald-300/15 bg-emerald-300/10 px-3 py-1.5 text-xs font-semibold text-emerald-200">
            {t("preview.synced")}
          </span>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <PreviewMetric icon={Clock3} label={t("preview.worked")} value={t("preview.workedValue")} />
          <PreviewMetric icon={Banknote} label={t("preview.earned")} value={t("preview.earnedValue")} accent />
        </div>

        <div className="mt-3 rounded-[22px] border border-white/[0.07] bg-black/30 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-white">{t("preview.recordTitle")}</p>
            <span className="text-xs text-white/36">{t("preview.recordDate")}</span>
          </div>
          <div className="mt-4 space-y-3">
            {activities.map((activity, index) => (
              <div key={activity.name} className="flex items-center gap-3">
                <span className={`h-8 w-1 rounded-full ${index === 0 ? "bg-amber-300" : "bg-sky-300"}`} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white/82">{activity.name}</p>
                  <p className="mt-0.5 text-xs text-white/36">{activity.detail}</p>
                </div>
                <span className="text-sm font-semibold text-white">{activity.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between rounded-[20px] border border-white/[0.07] bg-white/[0.035] px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-300/10 text-violet-200">
              <Palmtree className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-medium text-white/78">{t("preview.nextAbsence")}</p>
              <p className="text-xs text-white/36">{t("preview.nextAbsenceDate")}</p>
            </div>
          </div>
          <CheckCircle2 className="h-5 w-5 text-emerald-300" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

function PreviewMetric({
  icon: Icon,
  label,
  value,
  accent = false
}: {
  icon: typeof Clock3;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-[22px] border p-4 ${accent ? "border-amber-300/20 bg-amber-300/[0.07]" : "border-white/[0.07] bg-black/30"}`}>
      <Icon className={`h-4 w-4 ${accent ? "text-[#f4c95d]" : "text-white/42"}`} aria-hidden="true" />
      <p className="mt-4 text-xs text-white/38">{label}</p>
      <p className="mt-1 text-xl font-semibold text-white sm:text-2xl">{value}</p>
    </div>
  );
}

function MonthPreview({ t }: { t: (key: string) => string }) {
  const days = [
    { day: "21", hours: "8:00", active: true },
    { day: "22", hours: "7:30", active: true },
    { day: "23", hours: "6:45", active: true },
    { day: "24", hours: "—", active: false },
    { day: "25", hours: "8:15", active: true }
  ];

  return (
    <div
      role="img"
      aria-label={t("monthPreview.alt")}
      className="rounded-[32px] border border-white/[0.1] bg-black p-4 shadow-[0_28px_90px_rgba(0,0,0,0.4)] sm:p-6"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-white/34">{t("monthPreview.period")}</p>
          <h3 className="mt-2 text-xl font-semibold text-white">{t("monthPreview.title")}</h3>
        </div>
        <CalendarDays className="h-5 w-5 text-[#f4c95d]" aria-hidden="true" />
      </div>
      <div className="mt-6 grid grid-cols-3 gap-3">
        <SmallStat label={t("monthPreview.days")} value="18" />
        <SmallStat label={t("monthPreview.hours")} value="142h" />
        <SmallStat label={t("monthPreview.earnings")} value="€3,040" />
      </div>
      <div className="mt-6 rounded-[22px] border border-white/[0.07] bg-black/30 p-3">
        <div className="grid grid-cols-5 gap-2">
          {days.map((item) => (
            <div key={item.day} className={`rounded-2xl px-2 py-3 text-center ${item.active ? "bg-white/[0.055]" : "border border-dashed border-violet-300/20 bg-violet-300/[0.05]"}`}>
              <p className="text-xs text-white/34">{item.day}</p>
              <div className={`mx-auto my-3 h-1.5 w-1.5 rounded-full ${item.active ? "bg-amber-300" : "bg-violet-300"}`} />
              <p className="text-xs font-semibold text-white/72">{item.hours}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 text-xs text-white/38">
        <span className="h-2 w-2 rounded-full bg-violet-300" aria-hidden="true" />
        {t("monthPreview.absence")}
      </div>
    </div>
  );
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.035] p-3">
      <p className="text-[0.66rem] text-white/34 sm:text-xs">{label}</p>
      <p className="mt-2 text-sm font-semibold text-white sm:text-lg">{value}</p>
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
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#f4c95d]/80">{eyebrow}</p>
      <h2 className="text-balance text-3xl font-semibold leading-tight tracking-[-0.025em] text-white sm:text-5xl">{title}</h2>
      <p className="text-base leading-7 text-white/58 sm:text-lg">{body}</p>
    </div>
  );
}

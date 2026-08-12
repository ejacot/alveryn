import {
  ArrowDown,
  ArrowRight,
  Check,
  Languages,
  Moon,
  PackageCheck,
  RotateCcw,
  Sun
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useLocation } from "react-router-dom";
import { SUPPORT_EMAIL } from "../api/config";
import { recordMarketingEvent } from "../analytics/marketing-analytics";
import { AppLogo } from "../components/branding/app-logo";
import { DashboardDailySummaryCard } from "../components/dashboard/dashboard-daily-summary-card";
import { CalendarMonthGrid } from "../components/calendar/calendar-month-grid";
import { ScreenMessage } from "../components/ui/screen-message";
import { useAuth } from "../features/auth/use-auth";
import {
  calculateWelcomeDemo,
  INITIAL_WELCOME_DEMO_STATE,
  type WelcomeDemoState
} from "../features/welcome/welcome-demo";
import { calculateGrossAmount } from "../features/work-records/work-record-calculations";
import {
  addMonths,
  buildMonthGrid,
  formatMonthLabel,
  resolveMonthSwipeDirection,
  startOfMonth
} from "../features/calendar/calendar-utils";
import { applyAppLanguage, i18n } from "../i18n";
import {
  getNativeLanguageName,
  normalizeLanguage,
  storeLanguagePreference,
  SUPPORTED_LANGUAGES
} from "../i18n/language";
import { APP_HOME_PATH } from "../routes/app-paths";
import { formatMinutesAsDuration } from "../utils/format";
import { applyAppTheme } from "../utils/theme";

const PUBLIC_THEME_KEY = "alveryn.publicTheme";

export function WelcomePage() {
  const { t, i18n: translation } = useTranslation("welcome");
  const { isAuthenticated, isHydrating, user } = useAuth();
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  const demoRef = useRef<HTMLElement>(null);
  const [demo, setDemo] = useState<WelcomeDemoState>(INITIAL_WELCOME_DEMO_STATE);
  const hourlyResult = useMemo(() => calculateWelcomeDemo({ ...demo, mode: "hourly" }), [demo]);
  const unitResult = useMemo(() => calculateWelcomeDemo({ ...demo, mode: "unit" }), [demo]);
  const isInstalledApp = isStandaloneDisplayMode();
  useStoredPublicTheme();

  useEffect(() => {
    if (!isHydrating && !isAuthenticated && !isInstalledApp) {
      recordMarketingEvent("LANDING_VIEW");
    }
  }, [isAuthenticated, isHydrating, isInstalledApp]);

  if (isHydrating) return <ScreenMessage title={t("loading")} />;
  if (isAuthenticated) {
    return <Navigate to={user?.preferences?.onboardingCompleted ? APP_HOME_PATH : "/onboarding"} replace />;
  }
  if (isInstalledApp && location.pathname === "/") return <Navigate to={APP_HOME_PATH} replace />;

  const locale = translation.resolvedLanguage ?? "en";
  const currency = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2
  });
  const update = <Key extends keyof WelcomeDemoState>(key: Key, value: WelcomeDemoState[Key]) => {
    setDemo((current) => ({ ...current, [key]: value }));
  };
  const resetDemo = () => setDemo(INITIAL_WELCOME_DEMO_STATE);
  const openDemo = () => demoRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });

  return (
    <main data-testid="welcome-scroll" className="fixed inset-0 isolate overflow-y-auto overflow-x-hidden overscroll-y-contain bg-[#f7f9f8] text-[#101513]">
      <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[54rem] bg-[radial-gradient(circle_at_72%_8%,rgba(52,211,153,0.16),transparent_31%),radial-gradient(circle_at_20%_6%,rgba(167,243,208,0.20),transparent_25%)]" aria-hidden="true" />
      <PublicHeader />

      <section className="mx-auto grid min-h-[calc(100dvh-4rem)] w-full max-w-[86rem] gap-12 px-5 py-12 sm:px-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-center lg:px-12 lg:py-20">
        <div className="relative z-10 max-w-2xl">
          <p className="landing-hero-badge text-sm font-semibold text-emerald-700">{t("interactive.hero.eyebrow")}</p>
          <h1 className="mt-5 text-balance text-[3rem] font-semibold leading-[0.95] tracking-[-0.055em] text-[#0d1713] sm:text-6xl lg:text-[5rem]">
            {t("interactive.hero.title")}
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-xl sm:leading-8">
            {t("interactive.hero.body")}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={openDemo} className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#101513] px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/40">
              {t("interactive.hero.demoCta")}<ArrowDown className="ml-2 h-4 w-4" aria-hidden="true" />
            </button>
            <RegistrationLink className="inline-flex min-h-12 items-center justify-center rounded-full border border-slate-200 bg-white/70 px-6 text-sm font-semibold text-slate-800 transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30">
              {t("interactive.hero.accountCta")}
            </RegistrationLink>
          </div>
        </div>
        <WelcomeCalendarPreview label={t("interactive.product.heroLabel")} />
      </section>

      <SimpleDemoStory
        sectionRef={demoRef}
        demo={demo}
        update={update}
        reset={resetDemo}
        hourlyResult={hourlyResult}
        unitResult={unitResult}
        currency={currency}
      />

      <RevealSection id="why-alveryn" reduceMotion={reduceMotion} className="mx-auto max-w-[86rem] scroll-mt-16 px-5 py-24 sm:px-8 lg:px-12 lg:py-32">
        <SectionIntro eyebrow={t("interactive.why.eyebrow")} title={t("interactive.why.title")} body={t("interactive.why.body")} centered />
        <div className="mt-14 grid overflow-hidden rounded-[34px] border border-slate-200 bg-white shadow-[0_22px_70px_rgba(15,23,42,0.06)] lg:grid-cols-2">
          <ComparisonSide before />
          <ComparisonSide />
        </div>
      </RevealSection>

      <RevealSection reduceMotion={reduceMotion} className="border-y border-slate-200 bg-white">
        <div className="mx-auto grid max-w-[86rem] gap-12 px-5 py-24 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:px-12 lg:py-32">
          <SectionIntro eyebrow={t("interactive.payslip.eyebrow")} title={t("interactive.payslip.title")} body={t("interactive.payslip.body")} />
          <PayslipComparison currency={currency} />
        </div>
      </RevealSection>

      <RevealSection reduceMotion={reduceMotion} className="mx-auto max-w-[86rem] px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
        <div className="relative overflow-hidden rounded-[38px] bg-[#0d1713] px-6 py-16 text-center shadow-[0_30px_90px_rgba(15,23,42,0.16)] sm:px-12 sm:py-20">
          <div className="pointer-events-none absolute inset-x-1/4 -top-32 h-64 rounded-full bg-emerald-400/14 blur-3xl" aria-hidden="true" />
          <h2 className="relative mx-auto max-w-4xl text-balance text-4xl font-semibold tracking-[-0.045em] text-white sm:text-6xl">{t("interactive.final.title")}</h2>
          <p className="relative mx-auto mt-5 max-w-2xl text-base leading-7 text-white/56 sm:text-lg">{t("interactive.final.body")}</p>
          <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <RegistrationLink className="inline-flex min-h-12 items-center justify-center rounded-full bg-white px-7 text-sm font-semibold text-black transition hover:bg-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-300/70">
              {t("interactive.final.primary")}<ArrowRight className="ml-2 h-4 w-4" />
            </RegistrationLink>
            <button type="button" onClick={() => { resetDemo(); openDemo(); }} className="inline-flex min-h-12 items-center justify-center rounded-full px-6 text-sm font-semibold text-white/66 transition hover:bg-white/[0.06] hover:text-white focus:outline-none focus:ring-2 focus:ring-white/30">
              {t("interactive.final.restart")}
            </button>
          </div>
        </div>
      </RevealSection>
      <PublicFooter />
    </main>
  );
}

const HERO_WORK_DAYS: Record<string, { duration: string; earnings: string; intensity: number }> = {
  "2026-07-01": { duration: "8h", earnings: "€140", intensity: 0.8 },
  "2026-07-02": { duration: "7h", earnings: "€123", intensity: 0.7 },
  "2026-07-03": { duration: "8h", earnings: "€140", intensity: 0.8 },
  "2026-07-06": { duration: "6h", earnings: "€105", intensity: 0.6 },
  "2026-07-07": { duration: "8h", earnings: "€140", intensity: 0.8 },
  "2026-07-08": { duration: "9h", earnings: "€158", intensity: 0.9 },
  "2026-07-09": { duration: "7h", earnings: "€123", intensity: 0.7 },
  "2026-07-10": { duration: "8h", earnings: "€140", intensity: 0.8 },
  "2026-07-13": { duration: "8h", earnings: "€140", intensity: 0.8 },
  "2026-07-14": { duration: "7h", earnings: "€123", intensity: 0.7 },
  "2026-07-16": { duration: "8h", earnings: "€140", intensity: 0.8 },
  "2026-07-17": { duration: "6h", earnings: "€105", intensity: 0.6 },
  "2026-07-20": { duration: "8h", earnings: "€140", intensity: 0.8 },
  "2026-07-23": { duration: "9h", earnings: "€158", intensity: 0.9 },
  "2026-07-24": { duration: "8h", earnings: "€140", intensity: 0.8 },
  "2026-07-28": { duration: "7h", earnings: "€123", intensity: 0.7 },
  "2026-07-29": { duration: "8h", earnings: "€140", intensity: 0.8 },
  "2026-07-30": { duration: "8h", earnings: "€140", intensity: 0.8 },
  "2026-07-31": { duration: "6h", earnings: "€105", intensity: 0.6 }
};

function WelcomeCalendarPreview({ label }: { label: string }) {
  const { t } = useTranslation("calendar");
  const [activeMonth, setActiveMonth] = useState(() => new Date(2026, 6, 1));
  const [selectedDate, setSelectedDate] = useState<Date | null>(() => new Date(2026, 6, 18));
  const [slideDirection, setSlideDirection] = useState(0);
  const days = useMemo(() => buildMonthGrid(activeMonth), [activeMonth]);
  const absenceTypes = [
    { id: "demo-day-off", name: t("legend.dayOff"), code: "DAY_OFF" as const, paid: false, paidMinutesPerDay: 0, color: "#60a5fa", active: true, displayOrder: 1 },
    { id: "demo-sick", name: t("legend.sick"), code: "SICK_LEAVE" as const, paid: true, paidMinutesPerDay: 480, color: "#f59e0b", active: true, displayOrder: 2 },
    { id: "demo-vacation", name: t("legend.vacation"), code: "VACATION" as const, paid: true, paidMinutesPerDay: 480, color: "#a78bfa", active: true, displayOrder: 3 }
  ];
  const markers: Record<string, { label: string; color: string }> = {
    "2026-07-04": { label: t("restDay.title"), color: "rgba(255,255,255,0.5)" },
    "2026-07-05": { label: t("restDay.title"), color: "rgba(255,255,255,0.5)" },
    "2026-07-15": { label: t("marker.dayOff"), color: "#60a5fa" },
    "2026-07-18": { label: t("restDay.title"), color: "rgba(255,255,255,0.5)" },
    "2026-07-19": { label: t("restDay.title"), color: "rgba(255,255,255,0.5)" },
    "2026-07-21": { label: t("marker.sick"), color: "#f59e0b" },
    "2026-07-22": { label: t("marker.sick"), color: "#f59e0b" },
    "2026-07-25": { label: t("restDay.title"), color: "rgba(255,255,255,0.5)" },
    "2026-07-26": { label: t("restDay.title"), color: "rgba(255,255,255,0.5)" },
    "2026-07-27": { label: t("marker.vacation"), color: "#a78bfa" }
  };
  const changeMonth = (direction: -1 | 1) => {
    setSlideDirection(direction);
    setActiveMonth((month) => startOfMonth(addMonths(month, direction)));
    setSelectedDate(null);
  };

  return <section aria-label={label} className="welcome-calendar-preview aspect-square overflow-hidden rounded-[34px] border p-3 shadow-[0_30px_90px_rgba(15,23,42,0.12)] sm:p-7 lg:rotate-[0.5deg]">
    <CalendarMonthGrid
      monthLabel={formatMonthLabel(activeMonth)}
      monthKey={`${activeMonth.getFullYear()}-${activeMonth.getMonth() + 1}`}
      slideDirection={slideDirection}
      days={days}
      selectedDate={selectedDate}
      today={new Date(2026, 6, 18)}
      absenceTypes={absenceTypes}
      getDayMeta={(isoDate) => {
        const work = HERO_WORK_DAYS[isoDate];
        return {
          entriesCount: work ? 1 : 0,
          marker: markers[isoDate] ?? null,
          noActivityInTrackedRange: false,
          activityLabel: work?.duration ?? null,
          earningsLabel: work?.earnings ?? null,
          intensity: work?.intensity ?? 0
        };
      }}
      onSelect={setSelectedDate}
      onSwipeChange={changeMonth}
      onResolveSwipe={resolveMonthSwipeDirection}
    />
  </section>;
}

function SimpleDemoStory({
  sectionRef,
  demo,
  update,
  reset,
  hourlyResult,
  unitResult,
  currency
}: {
  sectionRef: RefObject<HTMLElement | null>;
  demo: WelcomeDemoState;
  update: <Key extends keyof WelcomeDemoState>(key: Key, value: WelcomeDemoState[Key]) => void;
  reset: () => void;
  hourlyResult: ReturnType<typeof calculateWelcomeDemo>;
  unitResult: ReturnType<typeof calculateWelcomeDemo>;
  currency: Intl.NumberFormat;
}) {
  const { t } = useTranslation("welcome");
  const [timeEntry, setTimeEntry] = useState<"hours" | "interval">("hours");
  const [hours, setHours] = useState(8);
  const directEarnings = calculateGrossAmount(hours * 60, demo.hourlyRate);
  const shownHours = timeEntry === "hours" ? `${hours}h` : formatMinutesAsDuration(hourlyResult.workedMinutes);
  const shownHourlyEarnings = timeEntry === "hours" ? directEarnings : hourlyResult.earnings;
  const monthEarnings = 2486.4 + shownHourlyEarnings + unitResult.earnings;

  const resetAll = () => {
    reset();
    setHours(8);
    setTimeEntry("hours");
  };

  return <section ref={sectionRef} id="live-demo" style={{ backgroundColor: "#ffffff" }} className="scroll-mt-16 border-y border-slate-200/70">
    <div className="mx-auto max-w-[86rem] px-5 py-24 sm:px-8 lg:px-12 lg:py-32">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <SectionIntro eyebrow={t("interactive.simple.eyebrow")} title={t("interactive.simple.title")} body={t("interactive.simple.body")} />
        <button type="button" onClick={resetAll} className="inline-flex min-h-11 shrink-0 items-center gap-2 self-start rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-emerald-500/30">
          <RotateCcw className="h-4 w-4" />{t("interactive.demo.reset")}
        </button>
      </div>

      <div className="mt-16 space-y-24 lg:space-y-32">
        <article className="grid items-center gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20">
          <div>
            <p className="text-sm font-semibold text-emerald-700">01 · {t("interactive.simple.timeEyebrow")}</p>
            <h3 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-5xl">{t("interactive.simple.timeTitle")}</h3>
            <p className="mt-4 max-w-lg text-base leading-7 text-slate-500 sm:text-lg">{t("interactive.simple.timeBody")}</p>
          </div>
          <div className="relative overflow-hidden rounded-[32px] border border-slate-200/80 bg-[#fbfcfc] p-5 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-8">
            <div className="absolute -right-24 -top-28 h-64 w-64 rounded-full bg-emerald-200/50 blur-3xl" aria-hidden="true" />
            <div className="relative flex rounded-full bg-slate-100 p-1" role="radiogroup" aria-label={t("interactive.simple.timeChoice")}>
              {(["hours", "interval"] as const).map((choice) => <button key={choice} type="button" role="radio" aria-checked={timeEntry === choice} onClick={() => setTimeEntry(choice)} className={`min-h-11 flex-1 rounded-full px-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-emerald-500/30 ${timeEntry === choice ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`}>{t(`interactive.simple.${choice}`)}</button>)}
            </div>
            <div className="relative mt-8">
              {timeEntry === "hours" ? <DemoNumberLight label={t("interactive.simple.hoursLabel")} value={hours} min={0} max={24} step={0.5} onChange={setHours} large /> : <div className="grid grid-cols-2 gap-3"><DemoInputLight label={t("interactive.fields.start")} type="time" value={demo.startTime} onChange={(value) => update("startTime", value)} /><DemoInputLight label={t("interactive.fields.end")} type="time" value={demo.endTime} onChange={(value) => update("endTime", value)} /></div>}
            </div>
            <div className="relative mt-7 rounded-[26px] bg-[#0b0d0c] p-3">
              <DashboardDailySummaryCard selectedDay={{ label: t("interactive.simple.todayResult"), entriesCount: 1, durationLabel: t("interactive.simple.hoursLabel"), totalDuration: shownHours, totalGross: currency.format(shownHourlyEarnings) }} onQuickAdd={() => setTimeEntry("interval")} />
            </div>
          </div>
        </article>

        <article className="grid items-center gap-10 lg:grid-cols-[1.28fr_0.72fr] lg:gap-20">
          <div className="relative order-2 overflow-hidden rounded-[32px] border border-slate-200/80 bg-[#fbfcfc] p-5 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-8 lg:order-1">
            <div className="absolute -bottom-24 -left-20 h-64 w-64 rounded-full bg-cyan-100/70 blur-3xl" aria-hidden="true" />
            <div className="relative flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-100 text-emerald-700"><PackageCheck className="h-5 w-5" /></span><div><p className="text-sm font-semibold text-slate-950">{t("interactive.simple.squareMeters")}</p><p className="text-xs text-slate-500">{t("interactive.simple.unitHint")}</p></div></div>
            <div className="relative mt-8 grid grid-cols-2 gap-3"><DemoNumberLight label={t("interactive.simple.areaLabel")} value={demo.quantity} min={0} step={1} onChange={(value) => update("quantity", value)} large /><DemoNumberLight label={t("interactive.simple.rateLabel")} value={demo.unitRate} min={0} step={0.1} onChange={(value) => update("unitRate", value)} large /></div>
            <SimpleResult label={t("interactive.simple.completedResult")} primary={`${demo.quantity} m²`} secondary={currency.format(unitResult.earnings)} />
          </div>
          <div className="order-1 lg:order-2">
            <p className="text-sm font-semibold text-emerald-700">02 · {t("interactive.simple.unitsEyebrow")}</p>
            <h3 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-5xl">{t("interactive.simple.unitsTitle")}</h3>
            <p className="mt-4 max-w-lg text-base leading-7 text-slate-500 sm:text-lg">{t("interactive.simple.unitsBody")}</p>
          </div>
        </article>

        <article aria-label={t("interactive.product.demoLabel")} className="pt-2">
          <div className="mx-auto max-w-3xl text-center"><p className="text-sm font-semibold text-emerald-700">03 · {t("interactive.simple.calendarEyebrow")}</p><h3 className="mt-3 text-balance text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-5xl">{t("interactive.simple.calendarTitle")}</h3><p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-500 sm:text-lg">{t("interactive.simple.calendarBody")}</p></div>
          <FullMonthCalendar earnings={monthEarnings} currency={currency} />
        </article>
      </div>
      <p className="sr-only" aria-live="polite">{t("interactive.demo.announcement", { amount: currency.format(shownHourlyEarnings) })}</p>
    </div>
  </section>;
}

function DemoInputLight({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="block text-xs font-semibold text-slate-500"><span>{label}</span><input type={type} value={value} onChange={(event) => onChange(event.currentTarget.value)} style={{ backgroundColor: "#ffffff", color: "#0f172a" }} className="mt-2 h-14 w-full rounded-2xl border border-slate-200 px-4 font-metric text-lg font-semibold outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" /></label>;
}

function DemoNumberLight({ label, value, onChange, min, max, step = 1, large = false }: { label: string; value: number; onChange: (value: number) => void; min?: number; max?: number; step?: number; large?: boolean }) {
  return <label className="block text-xs font-semibold text-slate-500"><span>{label}</span><input type="number" inputMode="decimal" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.currentTarget.value))} style={{ backgroundColor: "#ffffff", color: "#0f172a" }} className={`mt-2 w-full rounded-2xl border border-slate-200 px-4 font-metric font-semibold outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 ${large ? "h-20 text-3xl" : "h-14 text-lg"}`} /></label>;
}

function SimpleResult({ label, primary, secondary }: { label: string; primary: string; secondary: string }) {
  return <div className="relative mt-7 flex items-end justify-between gap-4 border-t border-slate-200 pt-6"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p><strong className="mt-2 block font-metric text-2xl text-slate-950">{primary}</strong></div><strong className="font-metric text-3xl text-emerald-700 sm:text-4xl">{secondary}</strong></div>;
}

function FullMonthCalendar({ earnings, currency }: { earnings: number; currency: Intl.NumberFormat }) {
  const { t } = useTranslation("welcome");
  const worked = new Set([1, 2, 3, 6, 7, 8, 9, 10, 13, 14, 15, 16, 17, 20, 21, 22, 23, 24]);
  const weekDays = t("interactive.simple.weekDays", { returnObjects: true }) as string[];
  return <div className="relative mx-auto mt-12 max-w-5xl overflow-hidden rounded-[34px] border border-slate-200 bg-white p-4 shadow-[0_28px_90px_rgba(15,23,42,0.09)] sm:p-8">
    <div className="absolute right-0 top-0 h-56 w-56 rounded-full bg-emerald-100/80 blur-3xl" aria-hidden="true" />
    <div className="relative flex flex-col gap-5 border-b border-slate-100 pb-6 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-emerald-700">{t("interactive.product.month")}</p><h4 className="mt-2 text-2xl font-semibold text-slate-950">{t("interactive.product.monthName")}</h4></div><div className="flex gap-8"><div><p className="text-xs text-slate-400">{t("interactive.simple.workedDays")}</p><strong className="mt-1 block font-metric text-xl text-slate-950">18</strong></div><div><p className="text-xs text-slate-400">{t("interactive.product.estimated")}</p><strong className="mt-1 block font-metric text-xl text-emerald-700">{currency.format(earnings)}</strong></div></div></div>
    <div className="relative mt-6 grid grid-cols-7 gap-1.5 sm:gap-2">{weekDays.map((day) => <span key={day} className="pb-2 text-center text-[10px] font-semibold uppercase text-slate-400 sm:text-xs">{day}</span>)}{Array.from({ length: 2 }, (_, index) => <span key={`empty-${index}`} />)}{Array.from({ length: 31 }, (_, index) => { const day = index + 1; const active = worked.has(day); return <div key={day} className={`flex aspect-square min-w-0 flex-col items-center justify-center rounded-xl border text-xs font-semibold sm:rounded-2xl sm:text-sm ${day === 18 ? "border-emerald-600 bg-emerald-600 text-white shadow-lg shadow-emerald-600/20" : active ? "border-emerald-100 bg-emerald-50 text-emerald-800" : "border-transparent bg-slate-50 text-slate-400"}`}><span>{day}</span>{active && day !== 18 ? <span className="mt-1 h-1 w-1 rounded-full bg-emerald-500" /> : null}</div>; })}</div>
    <div className="relative mt-6 flex items-center gap-5 border-t border-slate-100 pt-5 text-xs text-slate-500"><span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-emerald-500" />{t("interactive.simple.worked")}</span><span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-slate-200" />{t("interactive.simple.free")}</span></div>
  </div>;
}

function ComparisonSide({ before = false }: { before?: boolean }) {
  const { t } = useTranslation("welcome");
  const items = before ? ["messages", "memory", "notes", "spreadsheet"] : ["record", "rates", "totals", "history"];
  return <section className={`p-7 sm:p-10 ${before ? "bg-white" : "border-t border-slate-200 bg-emerald-50/60 lg:border-l lg:border-t-0"}`}>
    <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${before ? "text-slate-400" : "text-emerald-700"}`}>{t(`interactive.why.${before ? "before" : "with"}`)}</p>
    <h3 className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-slate-950">{t(`interactive.why.${before ? "beforeTitle" : "withTitle"}`)}</h3>
    <ul className="mt-8 space-y-5">{items.map((item) => <li key={item} className="flex items-start gap-3 text-sm leading-6 text-slate-600"><span className={`mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full ${before ? "bg-slate-100 text-slate-400" : "bg-emerald-100 text-emerald-700"}`}>{before ? "–" : <Check className="h-3 w-3" />}</span>{t(`interactive.why.items.${item}`)}</li>)}</ul>
  </section>;
}

function PayslipComparison({ currency }: { currency: Intl.NumberFormat }) {
  const { t } = useTranslation("welcome");
  const own = 2798.4;
  const paid = 2640;
  const difference = own - paid;
  return <figure className="overflow-hidden rounded-[32px] border border-white/[0.1] bg-[#070b09]">
    <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-5 sm:px-7"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-400">{t("interactive.payslip.label")}</p><p className="mt-2 text-xl font-semibold text-white">{t("interactive.payslip.comparison")}</p></div><Check className="h-5 w-5 text-emerald-400" /></div>
    <div className="grid grid-cols-[1.2fr_1fr] gap-4 px-5 py-5 sm:grid-cols-3 sm:px-7">
      <ComparisonMetric label={t("interactive.payslip.yourRecord")} value={currency.format(own)} />
      <ComparisonMetric label={t("interactive.payslip.received")} value={currency.format(paid)} />
      <ComparisonMetric label={t("interactive.payslip.difference")} value={`+${currency.format(difference)}`} accent />
    </div>
    <figcaption className="border-t border-white/[0.08] px-5 py-4 text-xs leading-5 text-white/38 sm:px-7">{t("interactive.payslip.disclaimer")}</figcaption>
  </figure>;
}

function ComparisonMetric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return <div><p className="text-xs text-white/38">{label}</p><strong className={`mt-2 block font-metric text-xl ${accent ? "text-emerald-400" : "text-white"}`}>{value}</strong></div>;
}

function SectionIntro({ eyebrow, title, body, centered = false }: { eyebrow: string; title: string; body: string; centered?: boolean }) {
  return <div className={`max-w-3xl ${centered ? "mx-auto text-center" : ""}`}><p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">{eyebrow}</p><h2 className="mt-4 text-balance text-4xl font-semibold leading-[1.02] tracking-[-0.045em] text-slate-950 sm:text-6xl">{title}</h2><p className="mt-5 text-base leading-7 text-slate-500 sm:text-lg sm:leading-8">{body}</p></div>;
}

function RevealSection({ children, reduceMotion, className, id }: { children: ReactNode; reduceMotion: boolean | null; className: string; id?: string }) {
  return <motion.section id={id} initial={reduceMotion ? false : { opacity: 0, y: 20 }} whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.5, ease: "easeOut" }} className={className}>{children}</motion.section>;
}

export function PublicHeader({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation("welcome");
  return <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 pt-[env(safe-area-inset-top)] backdrop-blur-2xl"><nav aria-label={t("nav.aria")} className="mx-auto flex h-14 max-w-[86rem] items-center justify-between gap-2 px-4 sm:h-16 sm:px-8 lg:px-12"><Link to="/welcome" aria-label="Alveryn"><AppLogo /></Link>{!compact ? <div className="hidden items-center gap-7 text-sm font-medium text-slate-500 md:flex"><a href="#live-demo" className="hover:text-slate-950">{t("interactive.nav.demo")}</a><a href="#why-alveryn" className="hover:text-slate-950">{t("interactive.nav.why")}</a></div> : null}<div className="flex items-center gap-1.5"><LanguageSelector /><ThemeToggle /><Link to="/login" className="hidden px-3 text-sm font-semibold text-slate-600 sm:inline">{t("nav.login")}</Link><RegistrationLink className="rounded-full bg-slate-950 px-4 py-2.5 text-xs font-semibold !text-white sm:text-sm">{t("nav.registerShort")}</RegistrationLink></div></nav></header>;
}

export function PublicFooter() {
  const { t } = useTranslation("welcome");
  return <footer className="border-t border-slate-200 bg-white"><div className="mx-auto grid max-w-[86rem] gap-8 px-5 py-10 sm:grid-cols-[1fr_auto] sm:px-8 lg:px-12"><div><AppLogo wordmark className="justify-start" /><p className="mt-4 max-w-md text-sm leading-6 text-slate-500">{t("footer.description")}</p><a href={`mailto:${SUPPORT_EMAIL}`} className="mt-3 inline-block text-sm text-emerald-700">{SUPPORT_EMAIL}</a></div><div className="flex flex-wrap items-center gap-5 text-sm text-slate-600"><a href="/welcome#live-demo">{t("interactive.nav.demo")}</a><Link to="/login">{t("nav.login")}</Link><RegistrationLink>{t("nav.register")}</RegistrationLink><LanguageSelector /></div><p className="text-xs text-slate-400 sm:col-span-2">© {new Date().getFullYear()} Alveryn</p></div></footer>;
}

export function RegistrationLink({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <Link to="/register" onClick={() => recordMarketingEvent("REGISTRATION_STARTED")} className={className}>{children}</Link>;
}

function LanguageSelector() {
  const { t } = useTranslation("welcome");
  return <label className="relative inline-flex min-h-10 items-center gap-1 rounded-full border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-600"><Languages className="h-3.5 w-3.5" /><span aria-hidden="true">{normalizeLanguage(i18n.resolvedLanguage).toUpperCase()}</span><select aria-label={t("nav.language")} value={normalizeLanguage(i18n.resolvedLanguage)} onChange={(event) => { const language = normalizeLanguage(event.target.value); storeLanguagePreference(language); applyAppLanguage(language); }} className="absolute inset-0 cursor-pointer opacity-0">{SUPPORTED_LANGUAGES.map((language) => <option key={language} value={language}>{getNativeLanguageName(language)}</option>)}</select></label>;
}

function ThemeToggle() {
  const { t } = useTranslation("welcome");
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = window.localStorage.getItem(PUBLIC_THEME_KEY);
    if (saved === "light" || saved === "dark") return saved;
    return document.documentElement.dataset.theme === "light" ? "light" : "dark";
  });
  const toggle = () => { const next = theme === "dark" ? "light" : "dark"; setTheme(next); window.localStorage.setItem(PUBLIC_THEME_KEY, next); applyAppTheme(next === "dark" ? "DARK" : "LIGHT"); };
  return <button type="button" onClick={toggle} aria-label={t(theme === "dark" ? "theme.light" : "theme.dark")} className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/30">{theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button>;
}

export function useStoredPublicTheme() {
  useEffect(() => { const saved = window.localStorage.getItem(PUBLIC_THEME_KEY); if (saved === "light" || saved === "dark") applyAppTheme(saved === "dark" ? "DARK" : "LIGHT"); }, []);
}

export function DashboardCardImage({ name, alt, priority = false, className = "" }: { name: "day" | "activity" | "flow" | "rhythm"; alt?: string; priority?: boolean; className?: string }) {
  const dimensions = name === "activity" ? [530, 294] : name === "day" ? [530, 258] : [530, 566];
  return <ThemedImage base={`/landing/dashboard/${name}`} alt={alt} priority={priority} width={dimensions[0]} height={dimensions[1]} className={className} />;
}
export function StatisticsCardImage({ name, alt }: { name: "filters" | "trend" | "kpis" | "compare" | "selected"; alt?: string }) { const dimensions = name === "filters" ? [530, 540] : name === "trend" ? [530, 600] : name === "kpis" ? [530, 340] : [530, 873]; return <ThemedImage base={`/landing/statistics-tour/${name}`} alt={alt} width={dimensions[0]} height={dimensions[1]} />; }
export function CalendarCardImage({ name, alt }: { name: "month" | "summary" | "payroll" | "flow" | "rhythm" | "tools"; alt?: string }) { const dimensions = name === "month" ? [530, 580] : name === "summary" ? [530, 835] : name === "payroll" ? [530, 790] : name === "tools" ? [530, 255] : [530, 425]; return <ThemedImage base={`/landing/calendar/${name}`} alt={alt} width={dimensions[0]} height={dimensions[1]} />; }

function ThemedImage({ base, alt = "", priority = false, width, height, className = "" }: { base: string; alt?: string; priority?: boolean; width: number; height: number; className?: string }) {
  const common = `h-auto w-full ${className}`;
  return <div className="overflow-hidden rounded-[20px] border border-white/[0.08] bg-black"><img src={`${base}-dark.jpg`} alt={alt} width={width} height={height} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"} decoding="async" className={`landing-theme-dark block ${common}`} /><img src={`${base}-light.jpg`} alt={alt} width={width} height={height} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"} decoding="async" className={`landing-theme-light hidden ${common}`} /></div>;
}

function isStandaloneDisplayMode() {
  if (typeof window === "undefined") return false;
  const iosNavigator = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.("(display-mode: standalone)").matches === true || iosNavigator.standalone === true;
}

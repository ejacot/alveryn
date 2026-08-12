import {
  ArrowRight,
  Check,
  Languages,
  Moon,
  PackageCheck,
  RotateCcw,
  Sun,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useLocation } from "react-router-dom";
import { SUPPORT_EMAIL } from "../api/config";
import { recordMarketingEvent } from "../analytics/marketing-analytics";
import { AppLogo } from "../components/branding/app-logo";
import { DashboardDailySummaryCard } from "../components/dashboard/dashboard-daily-summary-card";
import { CalendarMonthGrid } from "../components/calendar/calendar-month-grid";
import { CalendarMonthSummary } from "../components/calendar/calendar-month-summary";
import { ScreenMessage } from "../components/ui/screen-message";
import { StatisticsLineChart } from "../features/statistics/charts/statistics-line-chart";
import { useAuth } from "../features/auth/use-auth";
import {
  calculateWelcomeDemo,
  type WelcomeDemoState,
} from "../features/welcome/welcome-demo";
import { calculateGrossAmount } from "../features/work-records/work-record-calculations";
import {
  addMonths,
  buildMonthGrid,
  formatMonthLabel,
  resolveMonthSwipeDirection,
  startOfMonth,
} from "../features/calendar/calendar-utils";
import { applyAppLanguage, i18n } from "../i18n";
import {
  getNativeLanguageName,
  normalizeLanguage,
  storeLanguagePreference,
  SUPPORTED_LANGUAGES,
} from "../i18n/language";
import { APP_HOME_PATH } from "../routes/app-paths";
import { formatMinutesAsDuration } from "../utils/format";
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

const HERO_WORK_DAYS: Record<
  string,
  { duration: string; earnings: string; intensity: number }
> = {
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
  "2026-07-31": { duration: "6h", earnings: "€105", intensity: 0.6 },
};

function SwitchCase() {
  const { t } = useTranslation("welcome");
  const rows = t("switchCase.items", {
    returnObjects: true,
  }) as Array<{ from: string; to: string }>;
  return (
    <section
      id="why-alveryn"
      className="welcome-light-section border-y border-black/[0.07] bg-white text-[#111312]"
    >
      <div className="mx-auto max-w-[76rem] px-5 py-16 sm:px-8 lg:px-12 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <div>
            <h2 className="max-w-xl text-balance text-3xl font-semibold leading-[1.12] tracking-[-0.035em] sm:text-5xl">
              {t("switchCase.title")}
            </h2>
            <p className="mt-5 max-w-lg text-base leading-7 text-black/55">
              {t("switchCase.body")}
            </p>
          </div>
          <div className="divide-y divide-black/10 border-y border-black/10">
            {rows.map((row) => (
              <div
                key={row.from}
                className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-4 sm:gap-6"
              >
                <span className="text-sm text-black/45 sm:text-base">
                  {row.from}
                </span>
                <ArrowRight
                  className="h-4 w-4 text-emerald-700"
                  aria-hidden="true"
                />
                <strong className="text-sm font-semibold leading-5 sm:text-base">
                  {row.to}
                </strong>
              </div>
            ))}
          </div>
        </div>
        <p className="mx-auto mt-16 max-w-3xl text-center text-balance text-2xl font-medium leading-snug tracking-[-0.025em] sm:text-3xl">
          {t("workerQuestions.title")}
        </p>
      </div>
    </section>
  );
}

function ProductProof() {
  const { t } = useTranslation("welcome");
  const points = [105, 140, 158, 123, 140, 0, 0, 140, 123, 0, 140, 105].map(
    (value, index) => ({
      bucketStart: `2026-07-${String(index + 1).padStart(2, "0")}`,
      bucketEnd: `2026-07-${String(index + 1).padStart(2, "0")}`,
      value: String(value),
      metric: "GROSS" as const,
      currency: "EUR",
    }),
  );
  return (
    <section className="welcome-light-section hidden border-y border-black/[0.07] bg-white text-[#111312] sm:block">
      <div className="mx-auto grid max-w-[86rem] gap-8 px-5 py-16 sm:px-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-center lg:px-12 lg:py-24">
        <SectionIntro
          eyebrow={t("proof.eyebrow")}
          title={t("proof.title")}
          body={t("proof.body")}
        />
        <div className="welcome-statistics-scene max-h-[23rem] overflow-hidden rounded-[24px] border border-black/10 bg-[#0b0d0c] p-2 shadow-[0_24px_70px_rgba(17,19,18,0.12)] sm:p-5">
          <StatisticsLineChart
            points={points}
            metric="GROSS"
            granularity="DAILY"
          />
        </div>
      </div>
    </section>
  );
}

function WelcomeCalendarPreview({ label }: { label: string }) {
  const { t: welcomeT } = useTranslation("welcome");
  const { t, i18n: calendarI18n } = useTranslation("calendar");
  const [activeMonth, setActiveMonth] = useState(() => new Date(2026, 6, 1));
  const [selectedDate, setSelectedDate] = useState<Date | null>(
    () => new Date(2026, 6, 17),
  );
  const [slideDirection, setSlideDirection] = useState(0);
  const reduceMotion = useReducedMotion();
  const [sequenceStep, setSequenceStep] = useState(0);
  const days = useMemo(() => buildMonthGrid(activeMonth), [activeMonth]);
  const absenceTypes = [
    {
      id: "demo-day-off",
      name: t("legend.dayOff"),
      code: "DAY_OFF" as const,
      paid: false,
      paidMinutesPerDay: 0,
      color: "#60a5fa",
      active: true,
      displayOrder: 1,
    },
    {
      id: "demo-sick",
      name: t("legend.sick"),
      code: "SICK_LEAVE" as const,
      paid: true,
      paidMinutesPerDay: 480,
      color: "#f59e0b",
      active: true,
      displayOrder: 2,
    },
    {
      id: "demo-vacation",
      name: t("legend.vacation"),
      code: "VACATION" as const,
      paid: true,
      paidMinutesPerDay: 480,
      color: "#a78bfa",
      active: true,
      displayOrder: 3,
    },
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
    "2026-07-27": { label: t("marker.vacation"), color: "#a78bfa" },
  };
  const changeMonth = (direction: -1 | 1) => {
    setSlideDirection(direction);
    setActiveMonth((month) => startOfMonth(addMonths(month, direction)));
    setSelectedDate(null);
  };

  const selectedKey = selectedDate
    ? `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`
    : null;
  const selectedWork = selectedKey ? HERO_WORK_DAYS[selectedKey] : undefined;
  const selectedMarker = selectedKey ? markers[selectedKey] : undefined;

  useEffect(() => {
    const settle = () => setSequenceStep(4);
    window.addEventListener("welcome-motion-settle", settle);
    if (reduceMotion) {
      setSequenceStep(4);
      return () => window.removeEventListener("welcome-motion-settle", settle);
    }
    const timers = [650, 1450, 2250, 3050].map((delay, index) =>
      window.setTimeout(() => setSequenceStep(index + 1), delay),
    );
    return () => {
      timers.forEach(window.clearTimeout);
      window.removeEventListener("welcome-motion-settle", settle);
    };
  }, [reduceMotion]);

  const sequence = [
    { label: welcomeT("connectedDemo.activity"), value: "08:00–16:30" },
    { label: welcomeT("connectedDemo.day"), value: "8h · €164" },
    { label: welcomeT("connectedDemo.calendar"), value: "17 July" },
    { label: welcomeT("connectedDemo.month"), value: "€2,433" },
    {
      label: welcomeT("interactive.payslip.label"),
      value: welcomeT("connectedDemo.ready"),
    },
  ];

  return (
    <section
      aria-label={label}
      className="welcome-calendar-preview relative mx-auto w-full max-w-[760px] overflow-hidden rounded-[28px] border p-4 shadow-[0_30px_90px_rgba(15,23,42,0.12)] sm:p-6"
    >
      <div className="grid gap-6 md:grid-cols-[0.72fr_1.28fr] md:items-start">
        <div className="border-b border-white/10 pb-5 md:border-b-0 md:border-r md:pb-0 md:pr-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#10b981]">
            {welcomeT("recordSequence.eyebrow")}
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">
            {welcomeT("recordSequence.title")}
          </h2>
          <div className="mt-7 space-y-1">
            {sequence.map((item, index) => (
              <motion.div
                key={item.label}
                initial={false}
                animate={{
                  opacity: 1,
                  x: sequenceStep >= index ? 0 : -3,
                  backgroundColor:
                    sequenceStep === index
                      ? "rgba(16,185,129,0.10)"
                      : "rgba(16,185,129,0)",
                }}
                transition={{
                  duration: reduceMotion ? 0 : 0.32,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="flex items-center justify-between rounded-lg border-b border-white/[0.07] px-2 py-3"
              >
                <span className="text-xs text-white/66">{item.label}</span>
                <span
                  className={
                    index >= 3
                      ? "font-metric font-semibold text-[#34d399]"
                      : "font-metric font-semibold text-white/88"
                  }
                >
                  {item.value}
                </span>
              </motion.div>
            ))}
          </div>
          <p className="mt-5 text-xs leading-5 text-white/42">
            {welcomeT("recordSequence.caption")}
          </p>
        </div>

        <div>
          <div className="mb-4 flex items-center justify-between px-1">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[#10b981]">
                {welcomeT("interactive.why.with")}
              </p>
              <p className="mt-1 text-sm font-semibold text-white/82">
                {welcomeT("interactive.why.withTitle")}
              </p>
            </div>
            <span className="rounded-full bg-[#10b981]/10 px-3 py-1.5 text-[10px] font-semibold text-[#34d399]">
              {welcomeT("interactive.product.month")}
            </span>
          </div>

          <div className="grid gap-4">
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
                  intensity: work?.intensity ?? 0,
                };
              }}
              onSelect={setSelectedDate}
              onSwipeChange={changeMonth}
              onResolveSwipe={resolveMonthSwipeDirection}
            />

            <div className="grid gap-3 sm:grid-cols-2" aria-live="polite">
              <div className="rounded-[24px] border border-white/[0.08] bg-white/[0.045] p-4">
                <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[#10b981]">
                  {welcomeT("interactive.product.dailyRecord")}
                </p>
                <p className="mt-2 text-sm font-semibold text-white/90">
                  {selectedDate
                    ? new Intl.DateTimeFormat(calendarI18n.resolvedLanguage, {
                        day: "numeric",
                        month: "long",
                      }).format(selectedDate)
                    : welcomeT("interactive.product.month")}
                </p>
                {selectedWork ? (
                  <>
                    <p className="mt-4 text-xs font-medium text-white/48">
                      {welcomeT("interactive.product.hourlyShift")}
                    </p>
                    <div className="mt-2 flex items-end justify-between gap-3">
                      <span className="font-metric text-xl font-semibold text-white">
                        {selectedWork.duration}
                      </span>
                      <span className="font-metric text-base font-semibold text-[#34d399]">
                        {selectedWork.earnings}
                      </span>
                    </div>
                  </>
                ) : selectedMarker ? (
                  <p
                    className="welcome-selected-day-marker mt-5 text-sm font-semibold"
                    style={
                      {
                        "--welcome-marker-color": selectedMarker.color,
                      } as React.CSSProperties
                    }
                  >
                    {selectedMarker.label}
                  </p>
                ) : (
                  <p className="mt-5 text-xs leading-5 text-white/40">
                    {welcomeT("interactive.simple.calendarBody")}
                  </p>
                )}
              </div>

              <CalendarMonthSummary
                workedHours="139h"
                workGrossAmount="€2,433"
                workedDays={19}
                absenceDays={4}
                restDays={8}
                classifiedDays={31}
                totalDays={31}
                absenceBreakdown={[]}
                extraPayBreakdown={[]}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SimpleDemoStory({
  sectionRef,
  demo,
  update,
  reset,
  hourlyResult,
  unitResult,
  currency,
}: {
  sectionRef: RefObject<HTMLElement | null>;
  demo: WelcomeDemoState;
  update: <Key extends keyof WelcomeDemoState>(
    key: Key,
    value: WelcomeDemoState[Key],
  ) => void;
  reset: () => void;
  hourlyResult: ReturnType<typeof calculateWelcomeDemo>;
  unitResult: ReturnType<typeof calculateWelcomeDemo>;
  currency: Intl.NumberFormat;
}) {
  const { t } = useTranslation("welcome");
  const [timeEntry, setTimeEntry] = useState<"hours" | "interval">("hours");
  const [hours, setHours] = useState(8);
  const directEarnings = calculateGrossAmount(hours * 60, demo.hourlyRate);
  const shownHours =
    timeEntry === "hours"
      ? `${hours}h`
      : formatMinutesAsDuration(hourlyResult.workedMinutes);
  const shownHourlyEarnings =
    timeEntry === "hours" ? directEarnings : hourlyResult.earnings;
  const monthEarnings = 2486.4 + shownHourlyEarnings + unitResult.earnings;

  const resetAll = () => {
    reset();
    setHours(8);
    setTimeEntry("hours");
  };

  return (
    <section
      ref={sectionRef}
      id="live-demo"
      className="welcome-light-section welcome-demo-section scroll-mt-16 border-y border-slate-200/70 bg-white text-slate-950"
    >
      <div className="mx-auto max-w-[86rem] px-5 py-16 sm:px-8 lg:px-12 lg:py-24">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <SectionIntro
            eyebrow={t("interactive.simple.eyebrow")}
            title={t("interactive.simple.title")}
            body={t("interactive.simple.body")}
          />
          <button
            type="button"
            onClick={resetAll}
            className="inline-flex min-h-11 shrink-0 items-center gap-2 self-start rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          >
            <RotateCcw className="h-4 w-4" />
            {t("interactive.demo.reset")}
          </button>
        </div>

        <div className="mt-12 space-y-16 lg:space-y-20">
          <article className="grid items-center gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20">
            <div>
              <p className="text-sm font-semibold text-emerald-700">
                01 · {t("interactive.simple.timeEyebrow")}
              </p>
              <h3 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.035em] text-slate-950 sm:text-4xl">
                {t("interactive.simple.timeTitle")}
              </h3>
              <p className="mt-4 max-w-lg text-base leading-7 text-slate-500 sm:text-lg">
                {t("interactive.simple.timeBody")}
              </p>
            </div>
            <div className="relative overflow-hidden rounded-[32px] border border-slate-200/80 bg-[#fbfcfc] p-5 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-8">
              <div
                className="absolute -right-24 -top-28 h-64 w-64 rounded-full bg-emerald-200/50 blur-3xl"
                aria-hidden="true"
              />
              <div
                className="relative flex rounded-full bg-slate-100 p-1"
                role="radiogroup"
                aria-label={t("interactive.simple.timeChoice")}
              >
                {(["hours", "interval"] as const).map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    role="radio"
                    aria-checked={timeEntry === choice}
                    onClick={() => setTimeEntry(choice)}
                    className={`min-h-11 flex-1 rounded-full px-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-emerald-500/30 ${timeEntry === choice ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`}
                  >
                    {t(`interactive.simple.${choice}`)}
                  </button>
                ))}
              </div>
              <div className="relative mt-8">
                {timeEntry === "hours" ? (
                  <DemoNumberLight
                    label={t("interactive.simple.hoursLabel")}
                    value={hours}
                    min={0}
                    max={24}
                    step={0.5}
                    onChange={setHours}
                    large
                  />
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <DemoInputLight
                      label={t("interactive.fields.start")}
                      type="time"
                      value={demo.startTime}
                      onChange={(value) => update("startTime", value)}
                    />
                    <DemoInputLight
                      label={t("interactive.fields.end")}
                      type="time"
                      value={demo.endTime}
                      onChange={(value) => update("endTime", value)}
                    />
                  </div>
                )}
              </div>
              <div className="relative mt-7 rounded-[26px] bg-[#0b0d0c] p-3">
                <DashboardDailySummaryCard
                  selectedDay={{
                    label: t("interactive.simple.todayResult"),
                    entriesCount: 1,
                    durationLabel: t("interactive.simple.hoursLabel"),
                    totalDuration: shownHours,
                    totalGross: currency.format(shownHourlyEarnings),
                  }}
                  onQuickAdd={() => setTimeEntry("interval")}
                />
              </div>
            </div>
          </article>

          <article className="grid items-center gap-10 lg:grid-cols-[1.28fr_0.72fr] lg:gap-20">
            <div className="relative order-2 overflow-hidden rounded-[32px] border border-slate-200/80 bg-[#fbfcfc] p-5 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-8 lg:order-1">
              <div
                className="absolute -bottom-24 -left-20 h-64 w-64 rounded-full bg-cyan-100/70 blur-3xl"
                aria-hidden="true"
              />
              <div className="relative flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
                  <PackageCheck className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-950">
                    {t("interactive.simple.squareMeters")}
                  </p>
                  <p className="text-xs text-slate-500">
                    {t("interactive.simple.unitHint")}
                  </p>
                </div>
              </div>
              <div className="relative mt-8 grid grid-cols-2 gap-3">
                <DemoNumberLight
                  label={t("interactive.simple.areaLabel")}
                  value={demo.quantity}
                  min={0}
                  step={1}
                  onChange={(value) => update("quantity", value)}
                  large
                />
                <DemoNumberLight
                  label={t("interactive.simple.rateLabel")}
                  value={demo.unitRate}
                  min={0}
                  step={0.1}
                  onChange={(value) => update("unitRate", value)}
                  large
                />
              </div>
              <SimpleResult
                label={t("interactive.simple.completedResult")}
                primary={`${demo.quantity} m²`}
                secondary={currency.format(unitResult.earnings)}
              />
            </div>
            <div className="order-1 lg:order-2">
              <p className="text-sm font-semibold text-emerald-700">
                02 · {t("interactive.simple.unitsEyebrow")}
              </p>
              <h3 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.035em] text-slate-950 sm:text-4xl">
                {t("interactive.simple.unitsTitle")}
              </h3>
              <p className="mt-4 max-w-lg text-base leading-7 text-slate-500 sm:text-lg">
                {t("interactive.simple.unitsBody")}
              </p>
            </div>
          </article>

          <article
            aria-label={t("interactive.product.demoLabel")}
            className="pt-2"
          >
            <div className="max-w-3xl">
              <h3 className="text-balance text-3xl font-semibold leading-tight tracking-[-0.035em] text-slate-950 sm:text-4xl">
                {t("interactive.simple.calendarTitle")}
              </h3>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-500 sm:text-lg">
                {t("interactive.simple.calendarBody")}
              </p>
            </div>
            <div className="hidden sm:block">
              <FullMonthCalendar earnings={monthEarnings} currency={currency} />
              <DemoImpactRail
                activity={currency.format(shownHourlyEarnings)}
                day={shownHours}
                month={currency.format(monthEarnings)}
                points={[42, 58, 50, 72, 61, 86, Math.min(100, 48 + hours * 4)]}
              />
            </div>
            <MobileConnectedStory
              activity={currency.format(shownHourlyEarnings)}
              day={shownHours}
              month={currency.format(monthEarnings)}
            />
          </article>
        </div>
        <p className="sr-only" aria-live="polite">
          {t("interactive.demo.announcement", {
            amount: currency.format(shownHourlyEarnings),
          })}
        </p>
      </div>
    </section>
  );
}

function MobileConnectedStory({
  activity,
  day,
  month,
}: {
  activity: string;
  day: string;
  month: string;
}) {
  const { t } = useTranslation("welcome");
  const rootRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState(0);
  const stages = useMemo(
    () => [
      [t("connectedDemo.activity"), activity],
      [t("connectedDemo.day"), day],
      [t("connectedDemo.calendar"), t("connectedDemo.saved")],
      [t("connectedDemo.month"), month],
      [t("interactive.payslip.label"), t("connectedDemo.ready")],
    ],
    [activity, day, month, t],
  );

  useEffect(() => {
    const updateStage = () => {
      const root = rootRef.current;
      if (!root) return;
      const rect = root.getBoundingClientRect();
      const travel = Math.max(1, rect.height - window.innerHeight);
      const progress = Math.min(1, Math.max(0, -rect.top / travel));
      setStage(
        Math.min(stages.length - 1, Math.floor(progress * stages.length)),
      );
    };
    updateStage();
    window.addEventListener("scroll", updateStage, { passive: true });
    window.addEventListener("pageshow", updateStage);
    document.addEventListener("visibilitychange", updateStage);
    return () => {
      window.removeEventListener("scroll", updateStage);
      window.removeEventListener("pageshow", updateStage);
      document.removeEventListener("visibilitychange", updateStage);
    };
  }, [stages.length]);

  return (
    <div ref={rootRef} className="relative mt-8 h-[220dvh] sm:hidden">
      <div className="welcome-connected-mobile sticky top-20 flex min-h-[calc(100dvh-6rem)] flex-col justify-center rounded-[26px] border p-5 shadow-[0_18px_55px_rgba(15,23,42,0.09)]">
        <p className="welcome-connected-caption text-sm font-medium">
          {t("connectedDemo.mobileCaption")}
        </p>
        <div className="mt-6 space-y-3" aria-live="polite">
          {stages.map(([label, value], index) => (
            <div
              key={label}
              className={`welcome-connected-stage grid grid-cols-[1fr_auto] items-center gap-4 rounded-xl border px-4 py-3 ${index === stage ? "is-active" : ""}`}
            >
              <span className="text-sm font-medium">{label}</span>
              <strong className="font-metric">{value}</strong>
            </div>
          ))}
        </div>
        <div
          className="welcome-connected-progress mt-6 h-1 overflow-hidden rounded-full"
          aria-hidden="true"
        >
          <div
            className="h-full bg-emerald-600 transition-transform duration-200"
            style={{
              transform: `scaleX(${(stage + 1) / stages.length})`,
              transformOrigin: "left",
            }}
          />
        </div>
      </div>
    </div>
  );
}

function DemoInputLight({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block text-xs font-semibold text-slate-500">
      <span>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        style={{ backgroundColor: "#ffffff", color: "#0f172a" }}
        className="mt-2 h-14 w-full rounded-2xl border border-slate-200 px-4 font-metric text-lg font-semibold outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
      />
    </label>
  );
}

function DemoImpactRail({
  activity,
  day,
  month,
  points,
}: {
  activity: string;
  day: string;
  month: string;
  points: number[];
}) {
  const { t } = useTranslation("welcome");
  const stages = [
    [t("connectedDemo.activity"), activity],
    [t("connectedDemo.day"), day],
    [t("connectedDemo.calendar"), t("connectedDemo.saved")],
    [t("connectedDemo.month"), month],
  ];
  return (
    <div className="mt-5 grid gap-5 border-y border-slate-200 py-6 lg:grid-cols-[1fr_15rem] lg:items-center">
      <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
        {stages.map(([label, value], index) => (
          <motion.div
            key={label}
            initial={false}
            animate={{ y: 0, opacity: 1 }}
            className="relative min-w-0 border-l border-emerald-500/25 pl-3"
          >
            <span className="text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-400">
              {label}
            </span>
            <strong className="mt-1 block truncate font-metric text-base text-slate-950">
              {value}
            </strong>
            {index < stages.length - 1 ? (
              <ArrowRight
                className="absolute -right-2 top-5 hidden h-3.5 w-3.5 text-emerald-600/50 sm:block"
                aria-hidden="true"
              />
            ) : null}
          </motion.div>
        ))}
      </div>
      <div
        className="flex h-16 items-end gap-1"
        aria-label={t("connectedDemo.statistics")}
      >
        {points.map((point, index) => (
          <motion.span
            key={index}
            initial={false}
            animate={{ height: `${point}%` }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="min-h-1 flex-1 rounded-t-sm bg-emerald-600/70"
          />
        ))}
      </div>
    </div>
  );
}

function DemoNumberLight({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  large = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  large?: boolean;
}) {
  return (
    <label className="block text-xs font-semibold text-slate-500">
      <span>{label}</span>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        style={{ backgroundColor: "#ffffff", color: "#0f172a" }}
        className={`mt-2 w-full rounded-2xl border border-slate-200 px-4 font-metric font-semibold outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 ${large ? "h-20 text-3xl" : "h-14 text-lg"}`}
      />
    </label>
  );
}

function SimpleResult({
  label,
  primary,
  secondary,
}: {
  label: string;
  primary: string;
  secondary: string;
}) {
  return (
    <div className="relative mt-7 flex items-end justify-between gap-4 border-t border-slate-200 pt-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
          {label}
        </p>
        <strong className="mt-2 block font-metric text-2xl text-slate-950">
          {primary}
        </strong>
      </div>
      <strong className="font-metric text-3xl text-emerald-700 sm:text-4xl">
        {secondary}
      </strong>
    </div>
  );
}

function FullMonthCalendar({
  earnings,
  currency,
}: {
  earnings: number;
  currency: Intl.NumberFormat;
}) {
  const { t } = useTranslation("welcome");
  const worked = new Set([
    1, 2, 3, 6, 7, 8, 9, 10, 13, 14, 15, 16, 17, 20, 21, 22, 23, 24,
  ]);
  const weekDays = t("interactive.simple.weekDays", {
    returnObjects: true,
  }) as string[];
  return (
    <div className="relative mx-auto mt-12 max-w-5xl overflow-hidden rounded-[34px] border border-slate-200 bg-white p-4 shadow-[0_28px_90px_rgba(15,23,42,0.09)] sm:p-8">
      <div
        className="absolute right-0 top-0 h-56 w-56 rounded-full bg-emerald-100/80 blur-3xl"
        aria-hidden="true"
      />
      <div className="relative flex flex-col gap-5 border-b border-slate-100 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-emerald-700">
            {t("interactive.product.month")}
          </p>
          <h4 className="mt-2 text-2xl font-semibold text-slate-950">
            {t("interactive.product.monthName")}
          </h4>
        </div>
        <div className="flex gap-8">
          <div>
            <p className="text-xs text-slate-400">
              {t("interactive.simple.workedDays")}
            </p>
            <strong className="mt-1 block font-metric text-xl text-slate-950">
              18
            </strong>
          </div>
          <div>
            <p className="text-xs text-slate-400">
              {t("interactive.product.estimated")}
            </p>
            <strong className="mt-1 block font-metric text-xl text-emerald-700">
              {currency.format(earnings)}
            </strong>
          </div>
        </div>
      </div>
      <div className="relative mt-6 grid grid-cols-7 gap-1.5 sm:gap-2">
        {weekDays.map((day) => (
          <span
            key={day}
            className="pb-2 text-center text-[10px] font-semibold uppercase text-slate-400 sm:text-xs"
          >
            {day}
          </span>
        ))}
        {Array.from({ length: 2 }, (_, index) => (
          <span key={`empty-${index}`} />
        ))}
        {Array.from({ length: 31 }, (_, index) => {
          const day = index + 1;
          const active = worked.has(day);
          return (
            <div
              key={day}
              className={`flex aspect-square min-w-0 flex-col items-center justify-center rounded-xl border text-xs font-semibold sm:rounded-2xl sm:text-sm ${day === 18 ? "border-emerald-600 bg-emerald-600 text-white shadow-lg shadow-emerald-600/20" : active ? "border-emerald-100 bg-emerald-50 text-emerald-800" : "border-transparent bg-slate-50 text-slate-400"}`}
            >
              <span>{day}</span>
              {active && day !== 18 ? (
                <span className="mt-1 h-1 w-1 rounded-full bg-emerald-500" />
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="relative mt-6 flex items-center gap-5 border-t border-slate-100 pt-5 text-xs text-slate-500">
        <span className="flex items-center gap-2">
          <i className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          {t("interactive.simple.worked")}
        </span>
        <span className="flex items-center gap-2">
          <i className="h-2.5 w-2.5 rounded-full bg-slate-200" />
          {t("interactive.simple.free")}
        </span>
      </div>
    </div>
  );
}

function PayslipComparison({ currency }: { currency: Intl.NumberFormat }) {
  const { t } = useTranslation("welcome");
  const own = 2798.4;
  const paid = 2640;
  const difference = own - paid;
  return (
    <figure className="overflow-hidden rounded-[32px] border border-white/[0.1] bg-[#070b09]">
      <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-5 sm:px-7">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-400">
            {t("interactive.payslip.label")}
          </p>
          <p className="mt-2 text-xl font-semibold text-white">
            {t("interactive.payslip.comparison")}
          </p>
        </div>
        <Check className="h-5 w-5 text-emerald-400" />
      </div>
      <div className="grid grid-cols-[1.2fr_1fr] gap-4 px-5 py-5 sm:grid-cols-3 sm:px-7">
        <ComparisonMetric
          label={t("interactive.payslip.yourRecord")}
          value={currency.format(own)}
        />
        <ComparisonMetric
          label={t("interactive.payslip.received")}
          value={currency.format(paid)}
        />
        <ComparisonMetric
          label={t("interactive.payslip.difference")}
          value={`+${currency.format(difference)}`}
          accent
        />
      </div>
      <figcaption className="border-t border-white/[0.08] px-5 py-4 text-xs leading-5 text-white/38 sm:px-7">
        {t("interactive.payslip.disclaimer")}
      </figcaption>
    </figure>
  );
}

function ComparisonMetric({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-white/38">{label}</p>
      <strong
        className={`mt-2 block font-metric text-xl ${accent ? "text-emerald-400" : "text-white"}`}
      >
        {value}
      </strong>
    </div>
  );
}

function SectionIntro({
  eyebrow,
  title,
  body,
  centered = false,
}: {
  eyebrow: string;
  title: string;
  body: string;
  centered?: boolean;
}) {
  return (
    <div className={`max-w-3xl ${centered ? "mx-auto text-center" : ""}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
        {eyebrow}
      </p>
      <h2 className="mt-4 text-balance text-4xl font-semibold leading-[1.02] tracking-[-0.045em] text-slate-950 sm:text-6xl">
        {title}
      </h2>
      <p className="mt-5 text-base leading-7 text-slate-500 sm:text-lg sm:leading-8">
        {body}
      </p>
    </div>
  );
}

function RevealSection({
  children,
  reduceMotion,
  className,
  id,
}: {
  children: ReactNode;
  reduceMotion: boolean | null;
  className: string;
  id?: string;
}) {
  return (
    <motion.section
      id={id}
      initial={false}
      whileInView={reduceMotion ? undefined : { y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.section>
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

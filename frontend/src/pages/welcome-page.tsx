import {
  ArrowRight, BriefcaseBusiness, CalendarDays, Check, Clock3, FileDown,
  FileSpreadsheet, Languages, Moon, PackageCheck, Sun, Upload, Wrench
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useLocation } from "react-router-dom";
import { SUPPORT_EMAIL } from "../api/config";
import { recordMarketingEvent } from "../analytics/marketing-analytics";
import { AppLogo } from "../components/branding/app-logo";
import { ScreenMessage } from "../components/ui/screen-message";
import { useAuth } from "../features/auth/use-auth";
import { applyAppLanguage, i18n } from "../i18n";
import { getNativeLanguageName, normalizeLanguage, storeLanguagePreference, SUPPORTED_LANGUAGES } from "../i18n/language";
import { APP_HOME_PATH } from "../routes/app-paths";
import { applyAppTheme } from "../utils/theme";

const PUBLIC_THEME_KEY = "alveryn.publicTheme";
const workModeIcons = [Clock3, PackageCheck, Wrench, BriefcaseBusiness];
const audienceIcons = [Clock3, CalendarDays, PackageCheck, Wrench, BriefcaseBusiness, FileSpreadsheet];

export function WelcomePage() {
  const { t } = useTranslation("welcome");
  const { isAuthenticated, isHydrating, user } = useAuth();
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  const isInstalledApp = isStandaloneDisplayMode();
  useStoredPublicTheme();

  useEffect(() => {
    if (!isHydrating && !isAuthenticated && !isInstalledApp) recordMarketingEvent("LANDING_VIEW");
  }, [isAuthenticated, isHydrating, isInstalledApp]);

  if (isHydrating) return <ScreenMessage title={t("loading")} />;
  if (isAuthenticated) return <Navigate to={user?.preferences?.onboardingCompleted ? APP_HOME_PATH : "/onboarding"} replace />;
  if (isInstalledApp && location.pathname === "/") return <Navigate to={APP_HOME_PATH} replace />;

  return (
    <main data-testid="welcome-scroll" className="landing-page fixed inset-0 isolate overflow-y-auto overflow-x-hidden overscroll-y-contain bg-black text-white">
      <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[48rem] bg-[radial-gradient(circle_at_72%_8%,rgba(16,185,129,0.16),transparent_34%),radial-gradient(circle_at_18%_18%,rgba(255,255,255,0.08),transparent_28%)]" aria-hidden="true" />
      <PublicHeader />

      <section className="mx-auto grid min-h-[calc(100dvh-4rem)] w-full max-w-7xl gap-10 px-5 py-8 sm:px-8 sm:py-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-10 lg:py-16">
        <div className="space-y-7">
          <p className="landing-hero-badge inline-flex rounded-full border border-emerald-300/20 bg-emerald-300/[0.08] px-4 py-2 text-sm font-medium text-emerald-200">{t("hero.eyebrow")}</p>
          <div className="space-y-5">
            <h1 className="max-w-4xl text-balance text-[2.55rem] font-semibold leading-[0.98] tracking-[-0.04em] text-white sm:text-6xl lg:text-[4.15rem]">{t("hero.title")}</h1>
            <p className="max-w-xl text-base leading-7 text-white/64 sm:text-xl sm:leading-8">{t("hero.subtitle")}</p>
          </div>
          <MobileWorkPreview />
          <div className="flex flex-col gap-3 sm:flex-row">
            <RegistrationLink className="inline-flex min-h-[3.25rem] items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-black shadow-[0_20px_70px_rgba(255,255,255,0.12)] transition hover:bg-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-300/60">
              {t("hero.primaryCta")}<ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </RegistrationLink>
            <a href="#how-it-works" className="inline-flex min-h-[3.25rem] items-center justify-center rounded-full border border-white/[0.14] bg-white/[0.055] px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.1] focus:outline-none focus:ring-2 focus:ring-white/30">{t("hero.secondaryCta")}</a>
          </div>
          <div className="hidden flex-wrap gap-x-5 gap-y-2 pt-1 sm:flex">
            {[0, 1, 2].map((index) => <span key={index} className="inline-flex items-center gap-2 text-sm text-white/58"><Check className="h-4 w-4 text-emerald-500" />{t(`hero.points.${index}`)}</span>)}
          </div>
        </div>
        <div className="hidden lg:block"><HeroWorkPreview /></div>
      </section>

      <LandingSection id="problem" reduceMotion={reduceMotion} className="border-y border-white/[0.07] bg-white/[0.025]">
        <SectionIntro eyebrow={t("problem.eyebrow")} title={t("problem.title")} body={t("problem.body")} />
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[0, 1, 2, 3, 4].map((index) => <div key={index} className="rounded-[22px] border border-white/[0.08] bg-white/[0.035] p-5 text-sm leading-6 text-white/68">{t(`problem.points.${index}`)}</div>)}
        </div>
      </LandingSection>

      <LandingSection id="features" reduceMotion={reduceMotion}>
        <SectionIntro eyebrow={t("workModes.eyebrow")} title={t("workModes.title")} body={t("workModes.body")} centered />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((index) => {
            const Icon = workModeIcons[index];
            return <article key={index} className="rounded-[28px] border border-white/[0.08] bg-white/[0.04] p-6"><Icon className="h-5 w-5 text-emerald-500" /><h3 className="mt-6 text-lg font-semibold text-white">{t(`workModes.items.${index}.title`)}</h3><p className="mt-2 text-sm leading-6 text-white/52">{t(`workModes.items.${index}.body`)}</p><p className="mt-5 rounded-xl bg-emerald-400/[0.08] px-3 py-2.5 font-mono text-xs text-emerald-400">{t(`workModes.items.${index}.example`)}</p></article>;
          })}
        </div>
      </LandingSection>

      <LandingSection id="how-it-works" reduceMotion={reduceMotion} className="border-y border-white/[0.07] bg-white/[0.025]">
        <SectionIntro eyebrow={t("how.eyebrow")} title={t("how.title")} body={t("how.body")} centered />
        <ol className="mt-12 grid gap-4 lg:grid-cols-3">
          {[0, 1, 2].map((index) => <li key={index} className="rounded-[28px] border border-white/[0.08] bg-white/[0.035] p-6"><span className="grid h-9 w-9 place-items-center rounded-full bg-emerald-400/10 text-sm font-semibold text-emerald-500">{index + 1}</span><h3 className="mt-6 text-xl font-semibold text-white">{t(`how.steps.${index}.title`)}</h3><p className="mt-3 text-sm leading-6 text-white/54">{t(`how.steps.${index}.body`)}</p></li>)}
        </ol>
      </LandingSection>

      <LandingSection id="product-proof" reduceMotion={reduceMotion}>
        <SectionIntro eyebrow={t("proof.eyebrow")} title={t("proof.title")} body={t("proof.body")} centered />
        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          <ProductProofCard product="dashboard"><DashboardCardImage name="day" alt={t("proof.dashboard.alt")} /></ProductProofCard>
          <ProductProofCard product="calendar"><CalendarCardImage name="month" alt={t("proof.calendar.alt")} /></ProductProofCard>
          <ProductProofCard product="statistics"><StatisticsCardImage name="trend" alt={t("proof.statistics.alt")} /></ProductProofCard>
        </div>
      </LandingSection>

      <LandingSection reduceMotion={reduceMotion} className="border-y border-white/[0.07] bg-emerald-400/[0.025]">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <SectionIntro eyebrow={t("multipleJobs.eyebrow")} title={t("multipleJobs.title")} body={t("multipleJobs.body")} />
          <div className="grid gap-3 sm:grid-cols-2">
            {[0, 1].map((job) => <article key={job} className="rounded-[26px] border border-white/[0.09] bg-white/[0.04] p-6"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-500">{t(`multipleJobs.jobs.${job}.label`)}</p><h3 className="mt-3 text-xl font-semibold text-white">{t(`multipleJobs.jobs.${job}.title`)}</h3><ul className="mt-5 space-y-3">{[0, 1, 2].map((item) => <li key={item} className="flex gap-2 text-sm text-white/58"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />{t(`multipleJobs.jobs.${job}.points.${item}`)}</li>)}</ul></article>)}
          </div>
        </div>
      </LandingSection>

      <LandingSection reduceMotion={reduceMotion}>
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center"><PayslipPreview /><SectionIntro eyebrow={t("payslip.eyebrow")} title={t("payslip.title")} body={t("payslip.body")} /></div>
      </LandingSection>

      <LandingSection reduceMotion={reduceMotion} className="border-y border-white/[0.07] bg-white/[0.025]">
        <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <SectionIntro eyebrow={t("data.eyebrow")} title={t("data.title")} body={t("data.body")} />
          <div className="grid gap-3 sm:grid-cols-2"><InfoCard icon={<Upload />} title={t("data.import.title")} body={t("data.import.body")} /><InfoCard icon={<FileDown />} title={t("data.export.title")} body={t("data.export.body")} /></div>
        </div>
      </LandingSection>

      <LandingSection id="for-who" reduceMotion={reduceMotion}>
        <SectionIntro eyebrow={t("forWho.eyebrow")} title={t("forWho.title")} body={t("forWho.body")} centered />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((index) => { const Icon = audienceIcons[index]; return <article key={index} className="rounded-[24px] border border-white/[0.08] bg-white/[0.035] p-5"><Icon className="h-5 w-5 text-emerald-500" /><h3 className="mt-5 font-semibold text-white">{t(`forWho.items.${index}.title`)}</h3><p className="mt-2 text-sm leading-6 text-white/52">{t(`forWho.items.${index}.body`)}</p></article>; })}</div>
      </LandingSection>

      <LandingSection reduceMotion={reduceMotion} className="pb-16">
        <div className="relative overflow-hidden rounded-[38px] border border-white/[0.1] bg-white/[0.055] px-6 py-14 text-center sm:px-12 sm:py-16"><div className="pointer-events-none absolute inset-x-1/4 -top-32 h-64 rounded-full bg-emerald-400/15 blur-3xl" /><h2 className="relative mx-auto max-w-3xl text-balance text-4xl font-semibold text-white sm:text-5xl">{t("final.title")}</h2><p className="relative mx-auto mt-5 max-w-2xl text-lg leading-8 text-white/58">{t("final.subtitle")}</p><RegistrationLink className="relative mt-8 inline-flex min-h-[3.25rem] items-center rounded-full bg-white px-7 py-3 text-sm font-semibold text-black">{t("final.primaryCta")}<ArrowRight className="ml-2 h-4 w-4" /></RegistrationLink><div className="relative mt-5 flex flex-wrap justify-center gap-4 text-xs text-white/45">{[0, 1, 2].map((index) => <span key={index}>{t(`final.points.${index}`)}</span>)}</div></div>
      </LandingSection>
      <PublicFooter />
    </main>
  );
}

function HeroWorkPreview() {
  const { t } = useTranslation("welcome");
  return <div role="img" aria-label={t("hero.previewAlt")} className="relative mx-auto w-full max-w-[680px] rounded-[34px] border border-white/[0.12] bg-[#070b09] p-3 shadow-[0_35px_120px_rgba(0,0,0,0.5)] sm:p-4"><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-3"><DashboardCardImage name="day" alt={t("hero.dayAlt")} priority /><DashboardCardImage name="activity" alt={t("hero.activityAlt")} priority /></div><div className="grid content-center gap-3"><CalculationExample label={t("hero.examples.hourly.label")} work={t("hero.examples.hourly.work")} result={t("hero.examples.hourly.result")} /><CalculationExample label={t("hero.examples.unit.label")} work={t("hero.examples.unit.work")} result={t("hero.examples.unit.result")} /></div></div></div>;
}

function MobileWorkPreview() {
  const { t } = useTranslation("welcome");
  return <div data-testid="mobile-work-preview" className="grid grid-cols-[0.95fr_1.05fr] gap-2 rounded-[22px] border border-white/[0.1] bg-[#070b09] p-2 lg:hidden"><DashboardCardImage name="day" alt={t("hero.dayAlt")} priority className="self-center" /><div className="flex flex-col justify-center rounded-[15px] bg-white/[0.05] px-3 py-2"><p className="text-[0.55rem] font-semibold uppercase tracking-[0.12em] text-emerald-500">{t("hero.examples.hourly.label")}</p><p className="mt-1 text-[0.68rem] text-white/55">{t("hero.examples.hourly.work")}</p><p className="mt-1 text-sm font-semibold text-white">{t("hero.examples.hourly.result")}</p><p className="mt-2 border-t border-white/[0.08] pt-2 text-[0.6rem] leading-4 text-white/48">{t("hero.examples.unit.work")} → {t("hero.examples.unit.result")}</p></div></div>;
}

function CalculationExample({ label, work, result }: { label: string; work: string; result: string }) {
  return <div className="rounded-[20px] border border-white/[0.09] bg-white/[0.045] p-5"><p className="text-[0.65rem] font-semibold uppercase tracking-[0.13em] text-emerald-500">{label}</p><p className="mt-3 text-sm text-white/60">{work}</p><ArrowRight className="my-3 h-4 w-4 rotate-90 text-white/30" /><p className="text-xl font-semibold text-white">{result}</p></div>;
}

function ProductProofCard({ product, children }: { product: "dashboard" | "calendar" | "statistics"; children: ReactNode }) {
  const { t } = useTranslation("welcome");
  return <article className="overflow-hidden rounded-[30px] border border-white/[0.09] bg-white/[0.035]"><div className="p-3">{children}</div><div className="border-t border-white/[0.08] p-5"><h3 className="text-xl font-semibold text-white">{t(`proof.${product}.title`)}</h3><p className="mt-2 text-sm leading-6 text-white/52">{t(`proof.${product}.body`)}</p><Link to={`/welcome/${product}`} className="mt-4 inline-flex items-center text-sm font-semibold text-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/40">{t(`proof.${product}.link`)}<ArrowRight className="ml-1.5 h-4 w-4" /></Link></div></article>;
}

function InfoCard({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return <article className="rounded-[26px] border border-white/[0.09] bg-white/[0.04] p-6"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-400/10 text-emerald-500">{icon}</span><h3 className="mt-6 text-xl font-semibold text-white">{title}</h3><p className="mt-3 text-sm leading-6 text-white/54">{body}</p></article>;
}

function PayslipPreview() {
  const { t } = useTranslation("welcome");
  const rows = [[t("payslip.hours"), "168h", "160h", "+8h"], [t("payslip.gross"), "€3,850", "€3,640", "+€210"]];
  return <figure className="overflow-hidden rounded-[32px] border border-white/[0.1] bg-[#070b09] shadow-[0_28px_90px_rgba(0,0,0,0.4)]"><div className="border-b border-white/[0.1] px-5 py-5 sm:px-7"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-500">{t("payslip.document")}</p><p className="mt-2 text-xl font-semibold text-white">{t("payslip.comparisonTitle")}</p></div><div className="grid grid-cols-[1.1fr_1fr_1fr_0.9fr] px-5 py-3 text-[0.6rem] font-semibold uppercase text-white/40 sm:px-7"><span>{t("payslip.item")}</span><span>Alveryn</span><span>{t("payslip.documentShort")}</span><span className="text-right">{t("payslip.difference")}</span></div>{rows.map(([label, own, document, difference]) => <div key={label} className="grid grid-cols-[1.1fr_1fr_1fr_0.9fr] border-t border-white/[0.08] px-5 py-4 text-xs sm:px-7 sm:text-sm"><span className="text-white/52">{label}</span><strong className="text-white">{own}</strong><strong className="text-white">{document}</strong><strong className="text-right text-emerald-500">{difference}</strong></div>)}<figcaption className="border-t border-white/[0.08] px-5 py-4 text-xs leading-5 text-white/38 sm:px-7">{t("payslip.disclaimer")}</figcaption></figure>;
}

export function PublicHeader({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation("welcome");
  return <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-black/80 pt-[env(safe-area-inset-top)] backdrop-blur-2xl"><nav aria-label={t("nav.aria")} className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-2 px-4 sm:h-16 sm:px-8 lg:px-10"><Link to="/welcome" aria-label="Alveryn"><AppLogo /></Link>{!compact ? <div className="hidden items-center gap-6 text-sm font-medium text-white/58 md:flex"><a href="#how-it-works">{t("nav.how")}</a><a href="#features">{t("nav.features")}</a><a href="#for-who">{t("nav.forWho")}</a></div> : null}<div className="flex items-center gap-1.5"><LanguageSelector /><ThemeToggle /><Link to="/login" className="hidden px-3 text-sm font-semibold text-white/65 sm:inline">{t("nav.login")}</Link><RegistrationLink className="rounded-full bg-white px-4 py-2.5 text-xs font-semibold text-black sm:text-sm">{t("nav.registerShort")}</RegistrationLink></div></nav></header>;
}

export function PublicFooter() {
  const { t } = useTranslation("welcome");
  return <footer className="border-t border-white/[0.08]"><div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:grid-cols-[1fr_auto] sm:px-8 lg:px-10"><div><AppLogo wordmark className="justify-start" /><p className="mt-4 max-w-md text-sm leading-6 text-white/48">{t("footer.description")}</p><a href={`mailto:${SUPPORT_EMAIL}`} className="mt-3 inline-block text-sm text-emerald-500">{SUPPORT_EMAIL}</a></div><div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm text-white/58"><a href="/welcome#features">{t("nav.features")}</a><a href="/welcome#how-it-works">{t("nav.how")}</a><Link to="/login">{t("nav.login")}</Link><RegistrationLink>{t("nav.register")}</RegistrationLink><LanguageSelector /></div><p className="text-xs text-white/35 sm:col-span-2">© {new Date().getFullYear()} Alveryn</p></div></footer>;
}

export function RegistrationLink({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <Link to="/register" onClick={() => recordMarketingEvent("REGISTRATION_STARTED")} className={className}>{children}</Link>;
}

function LanguageSelector() {
  const { t } = useTranslation("welcome");
  return <label className="relative inline-flex min-h-10 items-center gap-1 rounded-full border border-white/[0.1] bg-white/[0.04] px-2 text-xs font-semibold text-white/68"><Languages className="h-3.5 w-3.5" /><span aria-hidden="true">{normalizeLanguage(i18n.resolvedLanguage).toUpperCase()}</span><select aria-label={t("nav.language")} value={normalizeLanguage(i18n.resolvedLanguage)} onChange={(event) => { const language = normalizeLanguage(event.target.value); storeLanguagePreference(language); applyAppLanguage(language); }} className="absolute inset-0 cursor-pointer opacity-0">{SUPPORTED_LANGUAGES.map((language) => <option key={language} value={language}>{getNativeLanguageName(language)}</option>)}</select></label>;
}

function ThemeToggle() {
  const { t } = useTranslation("welcome");
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = window.localStorage.getItem(PUBLIC_THEME_KEY);
    if (saved === "light" || saved === "dark") return saved;
    return document.documentElement.dataset.theme === "light" ? "light" : "dark";
  });
  const toggle = () => { const next = theme === "dark" ? "light" : "dark"; setTheme(next); window.localStorage.setItem(PUBLIC_THEME_KEY, next); applyAppTheme(next === "dark" ? "DARK" : "LIGHT"); };
  return <button type="button" onClick={toggle} aria-label={t(theme === "dark" ? "theme.light" : "theme.dark")} className="grid h-10 w-10 place-items-center rounded-full border border-white/[0.1] bg-white/[0.04] text-white/68 focus:outline-none focus:ring-2 focus:ring-emerald-400/40">{theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button>;
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

function SectionIntro({ eyebrow, title, body, centered = false }: { eyebrow: string; title: string; body: string; centered?: boolean }) { return <div className={`max-w-3xl ${centered ? "mx-auto text-center" : ""}`}><p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-500">{eyebrow}</p><h2 className="mt-4 text-balance text-3xl font-semibold leading-tight tracking-[-0.03em] text-white sm:text-5xl">{title}</h2><p className="mt-4 text-base leading-7 text-white/56 sm:text-lg">{body}</p></div>; }
function LandingSection({ id, children, className = "", reduceMotion }: { id?: string; children: ReactNode; className?: string; reduceMotion: boolean | null }) { return <motion.section id={id} initial={reduceMotion ? false : { opacity: 0, y: 24 }} whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.5, ease: "easeOut" }} className={className}><div className="mx-auto w-full max-w-7xl px-5 py-16 sm:px-8 lg:px-10 lg:py-24">{children}</div></motion.section>; }
function isStandaloneDisplayMode() { if (typeof window === "undefined") return false; const iosNavigator = window.navigator as Navigator & { standalone?: boolean }; return window.matchMedia?.("(display-mode: standalone)").matches === true || iosNavigator.standalone === true; }

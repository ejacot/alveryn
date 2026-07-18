import {
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ClipboardList,
  Layers3,
  Sparkles,
  WalletCards
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Link, Navigate } from "react-router-dom";
import calendarImage from "../assets/landing/calendar-desktop.webp";
import dashboardDesktop from "../assets/landing/dashboard-desktop.webp";
import dashboardMobile from "../assets/landing/dashboard-mobile.webp";
import entryFormImage from "../assets/landing/entry-form.webp";
import statisticsComparisonImage from "../assets/landing/statistics-comparison.webp";
import statisticsForecastImage from "../assets/landing/statistics-forecast.webp";
import statisticsHeatmapImage from "../assets/landing/statistics-heatmap.webp";
import statisticsOverviewImage from "../assets/landing/statistics-overview.webp";
import statisticsProductivityImage from "../assets/landing/statistics-productivity.webp";
import { AppLogo } from "../components/branding/app-logo";
import { ScreenMessage } from "../components/ui/screen-message";
import { useAuth } from "../features/auth/use-auth";
import { APP_HOME_PATH } from "../routes/app-paths";

type TextItem = {
  title: string;
  description: string;
};

type WorkTypeItem = TextItem & {
  examples: string;
};

type ProductShotProps = {
  src: string;
  mobileSrc?: string;
  alt: string;
  loading?: "eager" | "lazy";
  className?: string;
  imageClassName?: string;
  label?: string;
};

const benefitIcons = [ClipboardList, WalletCards, BriefcaseBusiness];
const workTypeIcons = [BriefcaseBusiness, BarChart3, WalletCards, Layers3];
const analyticsImages = [
  { key: "comparison", src: statisticsComparisonImage },
  { key: "forecast", src: statisticsForecastImage },
  { key: "productivity", src: statisticsProductivityImage },
  { key: "heatmap", src: statisticsHeatmapImage }
];

export function WelcomePage() {
  const { t } = useTranslation("welcome");
  const { isAuthenticated, isHydrating, user } = useAuth();
  const reduceMotion = useReducedMotion();
  const heroBenefits = t("hero.benefits", { returnObjects: true }) as string[];
  const problemQuestions = t("problem.questions", { returnObjects: true }) as string[];
  const setupSteps = t("setup.steps", { returnObjects: true }) as TextItem[];
  const recordSteps = t("record.steps", { returnObjects: true }) as TextItem[];
  const workTypes = t("workTypes.items", { returnObjects: true }) as WorkTypeItem[];
  const analyticsItems = t("analytics.items", { returnObjects: true }) as TextItem[];
  const calendarStats = t("calendar.stats", { returnObjects: true }) as string[];
  const isInstalledApp = isStandaloneDisplayMode();

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
      className="landing-page fixed inset-0 isolate overflow-y-auto overflow-x-hidden overscroll-y-contain bg-[#030303] text-white"
    >
      <div
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_50%_-12%,rgba(244,201,93,0.15),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0)_34%)]"
        aria-hidden="true"
      />

      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-black/72 backdrop-blur-2xl">
        <nav className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-5 sm:px-8 lg:px-10">
          <AppLogo className="justify-start" />
          <div className="hidden items-center gap-7 text-sm font-medium text-white/58 md:flex">
            <a href="#features" className="transition hover:text-white">
              {t("nav.features")}
            </a>
            <a href="#how-it-works" className="transition hover:text-white">
              {t("nav.how")}
            </a>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="inline-flex min-h-10 items-center justify-center rounded-full px-4 text-sm font-semibold text-white/68 transition hover:text-white focus:outline-none focus:ring-2 focus:ring-white/30"
            >
              {t("nav.login")}
            </Link>
            <Link
              to="/register"
              className="inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-full bg-white px-3 text-xs font-semibold text-black shadow-[0_18px_46px_rgba(255,255,255,0.16)] transition hover:bg-[#f4c95d] focus:outline-none focus:ring-2 focus:ring-[#f4c95d]/60 sm:px-4 sm:text-sm"
            >
              {t("nav.register")}
            </Link>
          </div>
        </nav>
      </header>

      <section className="relative mx-auto grid min-h-[calc(100dvh-4rem)] w-full max-w-7xl gap-12 px-5 py-12 sm:px-8 lg:grid-cols-[0.88fr_1.12fr] lg:items-center lg:px-10 lg:py-16">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 22 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.52, ease: "easeOut" }}
          className="space-y-8"
        >
          <p className="inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.055] px-4 py-2 text-sm font-medium text-white/70">
            <Sparkles className="h-4 w-4 text-[#f4c95d]" aria-hidden="true" />
            {t("hero.eyebrow")}
          </p>
          <div className="space-y-5">
            <h1 className="max-w-4xl text-balance text-5xl font-semibold leading-[0.95] tracking-normal text-white sm:text-6xl lg:text-7xl">
              {t("hero.title")}
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-white/66 sm:text-xl">{t("hero.subtitle")}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              to="/register"
              className="inline-flex min-h-[3.25rem] items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-black shadow-[0_20px_70px_rgba(255,255,255,0.16)] transition hover:bg-[#f4c95d] focus:outline-none focus:ring-2 focus:ring-[#f4c95d]/60"
            >
              {t("hero.primaryCta")}
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex min-h-[3.25rem] items-center justify-center rounded-full border border-white/[0.14] bg-white/[0.06] px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.1] focus:outline-none focus:ring-2 focus:ring-white/30"
            >
              {t("hero.secondaryCta")}
            </a>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {heroBenefits.map((benefit, index) => {
              const Icon = benefitIcons[index] ?? Check;
              return (
                <div key={benefit} className="min-w-0 rounded-[18px] border border-white/[0.08] bg-white/[0.045] p-3 sm:rounded-[22px] sm:p-4">
                  <Icon className="mb-2 h-4 w-4 text-[#f4c95d] sm:mb-3 sm:h-5 sm:w-5" aria-hidden="true" />
                  <p className="break-words text-[0.68rem] font-semibold leading-4 text-white/82 sm:text-sm">{benefit}</p>
                </div>
              );
            })}
          </div>
        </motion.div>

        <motion.div
          initial={reduceMotion ? false : { opacity: 0, scale: 0.985, y: 18 }}
          animate={reduceMotion ? undefined : { opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.08 }}
          className="relative mx-auto w-full max-w-[660px]"
        >
          <div className="absolute inset-10 rounded-[44px] bg-[#f4c95d]/18 blur-3xl" aria-hidden="true" />
          <ProductShot
            src={dashboardDesktop}
            mobileSrc={dashboardMobile}
            alt={t("images.dashboardAlt")}
            loading="eager"
            label={t("images.dashboardLabel")}
            className="relative"
            imageClassName="aspect-[1.28] object-cover object-top"
          />
        </motion.div>
      </section>

      <LandingSection id="features" reduceMotion={reduceMotion} className="border-y border-white/[0.06] bg-white/[0.025]">
        <div className="grid gap-10 lg:grid-cols-[0.78fr_1fr] lg:items-center">
          <SectionIntro eyebrow={t("problem.eyebrow")} title={t("problem.title")} body={t("problem.body")} />
          <div className="space-y-4">
            {problemQuestions.map((question) => (
              <div key={question} className="rounded-[28px] border border-white/[0.08] bg-black/28 p-5">
                <p className="text-xl font-semibold tracking-normal text-white">{question}</p>
              </div>
            ))}
            <p className="rounded-[28px] border border-[#f4c95d]/20 bg-[#f4c95d]/10 p-5 text-base leading-7 text-white/76">
              {t("problem.answer")}
            </p>
          </div>
        </div>
      </LandingSection>

      <LandingSection id="how-it-works" reduceMotion={reduceMotion}>
        <div className="grid gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
          <div className="space-y-8">
            <SectionIntro eyebrow={t("setup.eyebrow")} title={t("setup.title")} body={t("setup.body")} />
            <StepList items={setupSteps} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {workTypes.map((item, index) => {
              const Icon = workTypeIcons[index] ?? BriefcaseBusiness;
              return (
                <article key={item.title} className="rounded-[28px] border border-white/[0.08] bg-white/[0.045] p-5">
                  <Icon className="mb-5 h-6 w-6 text-[#f4c95d]" aria-hidden="true" />
                  <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-white/58">{item.description}</p>
                  <p className="mt-4 rounded-2xl bg-black/22 px-4 py-3 text-sm text-white/64">{item.examples}</p>
                </article>
              );
            })}
          </div>
        </div>
      </LandingSection>

      <LandingSection reduceMotion={reduceMotion} className="border-y border-white/[0.06] bg-white/[0.025]">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div className="space-y-8">
            <SectionIntro eyebrow={t("record.eyebrow")} title={t("record.title")} body={t("record.body")} />
            <StepList items={recordSteps} />
          </div>
          <ProductShot
            src={entryFormImage}
            alt={t("images.entryAlt")}
            label={t("images.entryLabel")}
            imageClassName="aspect-[1.05] object-cover object-top"
          />
        </div>
      </LandingSection>

      <LandingSection reduceMotion={reduceMotion}>
        <div className="space-y-10">
          <div className="grid gap-6 lg:grid-cols-[0.78fr_1fr] lg:items-end">
            <SectionIntro eyebrow={t("analytics.eyebrow")} title={t("analytics.title")} body={t("analytics.body")} />
            <div className="grid gap-3 sm:grid-cols-2">
              {analyticsItems.map((item) => (
                <div key={item.title} className="rounded-[24px] border border-white/[0.08] bg-black/24 p-4">
                  <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/54">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
          <ProductShot
            src={statisticsOverviewImage}
            alt={t("images.statisticsAlt")}
            label={t("images.statisticsLabel")}
            className="mx-auto max-w-[720px]"
            imageClassName="aspect-[1.55] object-cover object-top"
          />
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {analyticsImages.map((image) => (
              <ProductShot
                key={image.key}
                src={image.src}
                alt={t(`images.${image.key}Alt`)}
                className="h-full"
                imageClassName="aspect-[1.05] object-cover object-top"
              />
            ))}
          </div>
        </div>
      </LandingSection>

      <LandingSection reduceMotion={reduceMotion} className="border-y border-white/[0.06] bg-white/[0.025]">
        <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <ProductShot
            src={calendarImage}
            alt={t("images.calendarAlt")}
            label={t("images.calendarLabel")}
            imageClassName="aspect-[1.28] object-cover object-top"
          />
          <div className="space-y-7">
            <SectionIntro eyebrow={t("calendar.eyebrow")} title={t("calendar.title")} body={t("calendar.body")} />
            <div className="grid gap-3 sm:grid-cols-2">
              {calendarStats.map((stat) => (
                <div key={stat} className="rounded-[24px] border border-white/[0.08] bg-black/26 p-4">
                  <CalendarDays className="mb-4 h-5 w-5 text-[#f4c95d]" aria-hidden="true" />
                  <p className="text-sm font-semibold text-white/76">{stat}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </LandingSection>

      <LandingSection reduceMotion={reduceMotion} className="pb-20">
        <div className="rounded-[36px] border border-white/[0.1] bg-white/[0.055] p-7 text-center shadow-[0_28px_90px_rgba(0,0,0,0.36)] sm:p-12">
          <h2 className="mx-auto max-w-3xl text-balance text-4xl font-semibold leading-tight tracking-normal text-white sm:text-5xl">
            {t("final.title")}
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-white/62 sm:text-lg">{t("final.subtitle")}</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              to="/register"
              className="inline-flex min-h-[3.25rem] items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-[#f4c95d] focus:outline-none focus:ring-2 focus:ring-[#f4c95d]/60"
            >
              {t("final.primaryCta")}
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              to="/login"
              className="inline-flex min-h-[3.25rem] items-center justify-center rounded-full border border-white/[0.14] bg-white/[0.06] px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.1] focus:outline-none focus:ring-2 focus:ring-white/30"
            >
              {t("final.secondaryCta")}
            </Link>
          </div>
        </div>
      </LandingSection>
    </main>
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
      initial={reduceMotion ? false : { opacity: 0, y: 28 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.52, ease: "easeOut" }}
      className={className}
    >
      <div className="mx-auto w-full max-w-7xl px-5 py-16 sm:px-8 lg:px-10 lg:py-24">{children}</div>
    </motion.section>
  );
}

function SectionIntro({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <div className="max-w-3xl space-y-4">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#f4c95d]/80">{eyebrow}</p>
      <h2 className="text-balance text-3xl font-semibold leading-tight tracking-normal text-white sm:text-5xl">{title}</h2>
      <p className="text-base leading-7 text-white/62 sm:text-lg">{body}</p>
    </div>
  );
}

function StepList({ items }: { items: TextItem[] }) {
  return (
    <div className="space-y-4">
      {items.map((step, index) => (
        <div key={step.title} className="grid grid-cols-[auto_1fr] gap-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-sm font-semibold text-black">
            {index + 1}
          </span>
          <div>
            <h3 className="text-lg font-semibold text-white">{step.title}</h3>
            <p className="mt-2 text-sm leading-6 text-white/58">{step.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function ProductShot({
  src,
  mobileSrc,
  alt,
  loading = "lazy",
  className = "",
  imageClassName = "",
  label
}: ProductShotProps) {
  return (
    <figure
      className={`overflow-hidden rounded-[34px] border border-white/[0.1] bg-white/[0.045] p-2 shadow-[0_28px_90px_rgba(0,0,0,0.42)] ${className}`}
    >
      {label ? (
        <figcaption className="flex items-center justify-between px-4 pb-2 pt-3 text-xs font-semibold uppercase tracking-[0.16em] text-white/46">
          <span>{label}</span>
          <span className="h-2 w-2 rounded-full bg-[#f4c95d]" aria-hidden="true" />
        </figcaption>
      ) : null}
      <picture>
        {mobileSrc ? <source media="(max-width: 640px)" srcSet={mobileSrc} /> : null}
        <img
          src={src}
          alt={alt}
          loading={loading}
          decoding={loading === "eager" ? "sync" : "async"}
          className={`w-full rounded-[26px] ${imageClassName}`}
        />
      </picture>
    </figure>
  );
}

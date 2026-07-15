import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Coins,
  Gauge,
  PackageCheck,
  ShieldCheck,
  Smartphone,
  WalletCards
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, Navigate } from "react-router-dom";
import { AppLogo } from "../components/branding/app-logo";
import { ScreenMessage } from "../components/ui/screen-message";
import { useAuth } from "../features/auth/use-auth";
import { APP_HOME_PATH } from "../routes/app-paths";

type CardCopy = {
  title: string;
  description: string;
};

const featureIcons = [Clock3, PackageCheck, WalletCards, CalendarDays, BarChart3, Smartphone];
const stepNumbers = ["01", "02", "03"];

export function WelcomePage() {
  const { t } = useTranslation("welcome");
  const { isAuthenticated, isHydrating, user } = useAuth();
  const steps = t("steps.items", { returnObjects: true }) as CardCopy[];
  const features = t("features.items", { returnObjects: true }) as CardCopy[];
  const examples = t("examples.items", { returnObjects: true }) as string[];
  const calculations = t("calculations.items", { returnObjects: true }) as string[];

  if (isHydrating) {
    return <ScreenMessage title={t("loading")} />;
  }

  if (isAuthenticated) {
    return <Navigate to={user?.preferences?.onboardingCompleted ? APP_HOME_PATH : "/onboarding"} replace />;
  }

  return (
    <main className="min-h-screen overflow-x-clip bg-[#050608] text-white">
      <section className="relative border-b border-white/[0.08]">
        <div
          className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.16),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0)_48%)]"
          aria-hidden="true"
        />
        <div className="relative mx-auto flex min-h-[96svh] w-full max-w-6xl flex-col px-5 py-5 sm:px-8 lg:px-10">
          <nav className="flex items-center justify-between gap-4">
            <AppLogo className="justify-start" />
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="inline-flex min-h-10 items-center justify-center rounded-full px-4 text-sm font-semibold text-white/72 transition hover:text-white"
              >
                {t("nav.login")}
              </Link>
              <Link
                to="/register"
                className="inline-flex min-h-10 items-center justify-center rounded-full bg-white px-4 text-sm font-semibold text-black shadow-soft transition hover:bg-white/90"
              >
                {t("nav.register")}
              </Link>
            </div>
          </nav>

          <div className="flex flex-1 flex-col justify-center gap-10 py-12 lg:py-16">
            <div className="mx-auto max-w-4xl space-y-7 text-center">
              <p className="mx-auto inline-flex max-w-full items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.06] px-4 py-2 text-sm font-medium text-white/74">
                <ShieldCheck className="h-4 w-4 flex-none" aria-hidden="true" />
                <span>{t("hero.eyebrow")}</span>
              </p>
              <div className="space-y-5">
                <h1 className="mx-auto max-w-4xl text-balance text-5xl font-semibold leading-[0.98] tracking-normal text-white sm:text-6xl lg:text-7xl">
                  {t("hero.title")}
                </h1>
                <p className="mx-auto max-w-2xl text-lg leading-8 text-white/66 sm:text-xl">
                  {t("hero.subtitle")}
                </p>
              </div>
              <div className="flex flex-col justify-center gap-3 sm:flex-row">
                <Link
                  to="/register"
                  className="inline-flex min-h-[3.25rem] items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-black shadow-soft transition hover:bg-white/90"
                >
                  {t("hero.primaryCta")}
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </Link>
                <Link
                  to="/login"
                  className="inline-flex min-h-[3.25rem] items-center justify-center rounded-full border border-white/[0.14] bg-white/[0.06] px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.1]"
                >
                  {t("hero.secondaryCta")}
                </Link>
              </div>
            </div>

            <ProductPreview t={t} />
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 py-14 sm:px-8 lg:px-10">
        <div className="mb-7 max-w-3xl space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/42">
            {t("steps.eyebrow")}
          </p>
          <h2 className="text-3xl font-semibold tracking-normal text-white sm:text-4xl">
            {t("steps.title")}
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {steps.map((step, index) => (
            <article key={step.title} className="rounded-[24px] border border-white/[0.08] bg-white/[0.045] p-5">
              <p className="mb-5 text-sm font-semibold text-white/38">{stepNumbers[index]}</p>
              <h3 className="text-lg font-semibold text-white">{step.title}</h3>
              <p className="mt-3 text-sm leading-6 text-white/58">{step.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-white/[0.08] bg-white/[0.035]">
        <div className="mx-auto w-full max-w-6xl px-5 py-14 sm:px-8 lg:px-10">
          <div className="mb-8 grid gap-5 lg:grid-cols-[0.8fr_1fr] lg:items-end">
            <div className="space-y-3">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/42">
                {t("features.eyebrow")}
              </p>
              <h2 className="text-3xl font-semibold tracking-normal text-white sm:text-4xl">
                {t("features.title")}
              </h2>
            </div>
            <p className="max-w-2xl text-base leading-7 text-white/60 lg:justify-self-end">
              {t("features.subtitle")}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => {
              const Icon = featureIcons[index] ?? CheckCircle2;
              return (
                <article key={feature.title} className="rounded-[24px] border border-white/[0.08] bg-black/24 p-5">
                  <Icon className="mb-5 h-6 w-6 text-white" aria-hidden="true" />
                  <h3 className="text-lg font-semibold text-white">{feature.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-white/58">{feature.description}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[1fr_0.82fr] lg:px-10">
        <div className="space-y-5">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/42">
            {t("examples.eyebrow")}
          </p>
          <h2 className="text-3xl font-semibold tracking-normal text-white sm:text-4xl">
            {t("examples.title")}
          </h2>
          <div className="space-y-3">
            {examples.map((example) => (
              <div key={example} className="flex gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.045] p-4">
                <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none text-white" aria-hidden="true" />
                <p className="text-sm leading-6 text-white/64">{example}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-white/[0.1] bg-white/[0.055] p-5">
          <div className="mb-5 flex items-center gap-3">
            <Gauge className="h-6 w-6 text-white" aria-hidden="true" />
            <h3 className="text-xl font-semibold text-white">{t("calculations.title")}</h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {calculations.map((item) => (
              <div key={item} className="rounded-2xl border border-white/[0.08] bg-black/24 px-4 py-3">
                <p className="text-sm leading-6 text-white/68">{item}</p>
              </div>
            ))}
          </div>
          <p className="mt-5 text-sm leading-6 text-white/46">{t("calculations.note")}</p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 pb-16 sm:px-8 lg:px-10">
        <div className="rounded-[32px] border border-white/[0.1] bg-white/[0.06] p-6 text-center sm:p-10">
          <h2 className="mx-auto max-w-3xl text-3xl font-semibold tracking-normal text-white sm:text-4xl">
            {t("final.title")}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-white/62">
            {t("final.subtitle")}
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              to="/register"
              className="inline-flex min-h-[3.25rem] items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-black shadow-soft transition hover:bg-white/90"
            >
              {t("final.primaryCta")}
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              to="/login"
              className="inline-flex min-h-[3.25rem] items-center justify-center rounded-full border border-white/[0.14] bg-white/[0.06] px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.1]"
            >
              {t("final.secondaryCta")}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function ProductPreview({ t }: { t: (key: string) => string }) {
  return (
    <div className="mx-auto w-full max-w-5xl rounded-[34px] border border-white/[0.1] bg-white/[0.05] p-3 shadow-[0_32px_120px_rgba(0,0,0,0.44)] backdrop-blur-xl sm:p-4">
      <div className="grid gap-4 rounded-[28px] border border-white/[0.08] bg-black/62 p-4 md:grid-cols-[0.96fr_1fr]">
        <div className="rounded-[24px] border border-white/[0.08] bg-white/[0.055] p-4">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-white/52">{t("preview.today")}</p>
              <p className="text-3xl font-semibold text-white">8h 00m</p>
            </div>
            <div className="rounded-2xl bg-white px-3 py-2 text-right text-black">
              <p className="text-xs font-medium">{t("preview.gross")}</p>
              <p className="text-lg font-semibold">136 EUR</p>
            </div>
          </div>
          <div className="space-y-3">
            <PreviewRow title={t("preview.timeEntryTitle")} meta={t("preview.timeEntryMeta")} value="8h" />
            <PreviewRow title={t("preview.unitEntryTitle")} meta={t("preview.unitEntryMeta")} value="49 EUR" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <MetricCard icon={Gauge} label={t("preview.dailyAverage")} value="7h 35m" />
          <MetricCard icon={Coins} label={t("preview.monthTotal")} value="1.842 EUR" />
        </div>
      </div>
    </div>
  );
}

function PreviewRow({ title, meta, value }: { title: string; meta: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-black/22 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-white">{title}</p>
          <p className="mt-1 truncate text-sm text-white/52">{meta}</p>
        </div>
        <p className="shrink-0 text-sm font-semibold text-white">{value}</p>
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value
}: {
  icon: typeof Gauge;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[24px] border border-white/[0.08] bg-white/[0.055] p-4">
      <Icon className="mb-4 h-5 w-5 text-white/72" aria-hidden="true" />
      <p className="text-sm text-white/54">{label}</p>
      <p className="mt-1 text-xl font-semibold text-white">{value}</p>
    </div>
  );
}

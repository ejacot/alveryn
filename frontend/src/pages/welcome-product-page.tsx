import { ArrowLeft, ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, Navigate } from "react-router-dom";
import { AppLogo } from "../components/branding/app-logo";
import { ScreenMessage } from "../components/ui/screen-message";
import { useAuth } from "../features/auth/use-auth";
import { APP_HOME_PATH } from "../routes/app-paths";
import { CalendarCardImage, DashboardCardImage, StatisticsCardImage } from "./welcome-page";

export type WelcomeProduct = "dashboard" | "calendar" | "statistics";

const productCards = {
  dashboard: ["day", "activity", "rhythm"],
  calendar: ["month", "summary", "payroll", "flow", "rhythm", "tools"],
  statistics: ["filters", "trend", "compare", "selected"]
} as const;

export function WelcomeProductPage({ product }: { product: WelcomeProduct }) {
  const { t } = useTranslation("welcome");
  const { isAuthenticated, isHydrating, user } = useAuth();

  if (isHydrating) return <ScreenMessage title={t("loading")} />;
  if (isAuthenticated) return <Navigate to={user?.preferences?.onboardingCompleted ? APP_HOME_PATH : "/onboarding"} replace />;

  const namespace = product === "dashboard" ? "dashboardTour" : product === "calendar" ? "calendarTour" : "statisticsTour";
  const cards = productCards[product];

  return (
    <main className="landing-page fixed inset-0 overflow-y-auto bg-black text-white">
      <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-black/80 pt-[env(safe-area-inset-top)] backdrop-blur-2xl">
        <nav className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:h-16 sm:px-8">
          <Link to="/welcome" className="inline-flex items-center gap-2 text-sm font-semibold text-white/62 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">{t("productPages.back")}</span>
          </Link>
          <AppLogo />
          <Link to="/register" className="rounded-full bg-white px-4 py-2.5 text-xs font-semibold text-black sm:text-sm">{t("nav.registerShort")}</Link>
        </nav>
      </header>

      <section className="mx-auto max-w-7xl px-5 pb-12 pt-14 text-center sm:px-8 sm:pt-20">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-500">{t(`productPages.${product}.eyebrow`)}</p>
        <h1 className="mx-auto mt-5 max-w-4xl text-balance text-5xl font-semibold leading-[0.98] tracking-[-0.04em] text-white sm:text-7xl">{t(`${namespace}.title`)}</h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-white/56">{t(`${namespace}.body`)}</p>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-5 pb-20 sm:px-8 md:grid-cols-2">
        {cards.map((card) => (
          <article key={card} className={`overflow-hidden rounded-[30px] border border-white/[0.09] bg-white/[0.035] ${product === "dashboard" && card === "day" ? "md:col-span-2" : ""}`}>
            <div className={`grid gap-3 p-3 sm:p-4 ${product === "dashboard" && card === "day" ? "sm:grid-cols-[0.82fr_1.18fr] sm:items-start" : ""}`}>
              <ProductImage product={product} card={card} />
              {product === "dashboard" && card === "day" ? <DashboardCardImage name="flow" /> : null}
              {product === "statistics" && card === "trend" ? <StatisticsCardImage name="kpis" /> : null}
            </div>
            <div className="border-t border-white/[0.08] px-5 py-5 sm:px-6">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-emerald-500">{t(`${namespace}.cards.${card}.tag`)}</p>
              <h2 className="mt-2 text-xl font-semibold text-white">{t(`${namespace}.cards.${card}.title`)}</h2>
              <p className="mt-2 text-sm leading-6 text-white/52">{t(`${namespace}.cards.${card}.body`)}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="border-t border-white/[0.07] px-5 py-16 text-center sm:px-8">
        <h2 className="text-3xl font-semibold text-white">{t("productPages.ctaTitle")}</h2>
        <Link to="/register" className="mt-7 inline-flex items-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-black">
          {t("hero.primaryCta")} <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </section>
    </main>
  );
}

function ProductImage({ product, card }: { product: WelcomeProduct; card: string }) {
  if (product === "dashboard") return <DashboardCardImage name={card as "day" | "activity" | "rhythm"} />;
  if (product === "calendar") return <CalendarCardImage name={card as "month" | "summary" | "payroll" | "flow" | "rhythm" | "tools"} />;
  return <StatisticsCardImage name={card as "filters" | "trend" | "compare" | "selected"} />;
}

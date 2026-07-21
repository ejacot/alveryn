import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, LogOut, RefreshCw, UsersRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getFounderDashboard } from "../api/endpoints";
import { queryKeys } from "../api/query-keys";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { useAuth } from "../features/auth/use-auth";
import type { FounderDashboard, FounderUser } from "../types/admin";

export function FounderDashboardPage() {
  const { t, i18n } = useTranslation(["settings", "common"]);
  const { logout } = useAuth();
  const dashboardQuery = useQuery({
    queryKey: queryKeys.founderDashboard(),
    queryFn: getFounderDashboard,
    staleTime: 60_000
  });

  return (
    <div className="min-h-screen bg-black px-5 text-white">
      <div className="mx-auto w-full max-w-[760px] space-y-6 pb-20 pt-[max(2rem,calc(env(safe-area-inset-top)+1rem))]">
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="font-name text-[0.7rem] uppercase tracking-[0.28em] text-white/36">Alveryn</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-[-0.05em]">{t("settings:founder.title")}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              aria-label={t("settings:founder.refresh")}
              onClick={() => void dashboardQuery.refetch()}
            >
              <RefreshCw className={`h-4 w-4 ${dashboardQuery.isFetching ? "animate-spin" : ""}`} />
            </Button>
            <Button variant="ghost" aria-label="Sign out" onClick={() => void logout()}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

      {dashboardQuery.isLoading ? <FounderSkeleton /> : null}
      {dashboardQuery.isError ? (
        <Card className="p-5 text-sm leading-6 text-white/60">
          {t("settings:founder.error")}
        </Card>
      ) : null}
      {dashboardQuery.data ? (
        <FounderContent
          dashboard={dashboardQuery.data}
          locale={i18n.resolvedLanguage || "en"}
          t={t}
        />
      ) : null}
      </div>
    </div>
  );
}

function FounderContent({
  dashboard,
  locale,
  t
}: {
  dashboard: FounderDashboard;
  locale: string;
  t: ReturnType<typeof useTranslation<["settings", "common"]>>["t"];
}) {
  const overviewMetrics = [
    ["totalUsers", dashboard.overview.totalUsers],
    ["activeToday", dashboard.overview.activeToday],
    ["active7", dashboard.overview.activeLast7Days],
    ["active30", dashboard.overview.activeLast30Days],
    ["newToday", dashboard.overview.registrationsToday],
    ["new7", dashboard.overview.registrationsLast7Days]
  ] as const;

  const funnel = [
    ["registered", dashboard.activation.registered],
    ["verified", dashboard.activation.verified],
    ["setup", dashboard.activation.trackingSetupCompleted],
    ["employment", dashboard.activation.employmentCreated],
    ["workType", dashboard.activation.workTypeCreated],
    ["firstSession", dashboard.activation.firstWorkSessionCreated]
  ] as const;

  const usage = [
    ["timeUsers", dashboard.usage.timeTrackingUsers],
    ["earningsUsers", dashboard.usage.earningsTrackingUsers],
    ["workSessions", dashboard.usage.workSessions],
    ["projects", dashboard.usage.projects],
    ["checkIns", dashboard.usage.checkIns],
    ["pdfExports", dashboard.usage.pdfExports]
  ] as const;

  return (
    <>
      <section className="space-y-2">
        <p className="hairline-text">{t("settings:founder.overview")}</p>
        <div className="grid grid-cols-2 gap-3">
          {overviewMetrics.map(([key, value]) => (
            <Card key={key} className="min-h-24 p-4">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.15em] text-white/36">
                {t(`settings:founder.metrics.${key}`)}
              </p>
              <p className="mt-3 text-[1.8rem] font-semibold leading-none tracking-[-0.06em] text-white">
                {value.toLocaleString(locale)}
              </p>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <p className="hairline-text">{t("settings:founder.registrations")}</p>
        <Card className="p-5">
          <RegistrationChart points={dashboard.registrations} />
          <div className="mt-3 flex justify-between text-[0.68rem] font-medium text-white/30">
            <span>{formatShortDate(dashboard.registrations[0]?.date, locale)}</span>
            <span>{formatShortDate(dashboard.registrations.at(-1)?.date, locale)}</span>
          </div>
        </Card>
      </section>

      <section className="space-y-2">
        <p className="hairline-text">{t("settings:founder.activation")}</p>
        <Card className="space-y-4 p-5">
          {funnel.map(([key, value]) => {
            const percent = dashboard.activation.registered
              ? Math.round((value / dashboard.activation.registered) * 100)
              : 0;
            return (
              <div key={key}>
                <div className="mb-2 flex items-center justify-between gap-4 text-sm">
                  <span className="text-white/72">{t(`settings:founder.funnel.${key}`)}</span>
                  <span className="font-semibold text-white">{value} <span className="text-white/35">· {percent}%</span></span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div className="h-full rounded-full bg-white/75" style={{ width: `${percent}%` }} />
                </div>
              </div>
            );
          })}
        </Card>
      </section>

      <section className="space-y-2">
        <p className="hairline-text">{t("settings:founder.usage")}</p>
        <Card className="grid grid-cols-2 overflow-hidden">
          {usage.map(([key, value], index) => (
            <div
              key={key}
              className={`p-5 ${index % 2 === 0 ? "border-r border-white/[0.06]" : ""} ${index >= 2 ? "border-t border-white/[0.06]" : ""}`}
            >
              <p className="text-xs leading-4 text-white/40">{t(`settings:founder.usageMetrics.${key}`)}</p>
              <p className="mt-2 text-xl font-semibold tracking-[-0.04em] text-white">{value}</p>
            </div>
          ))}
        </Card>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <p className="hairline-text">{t("settings:founder.users")}</p>
          <span className="text-xs text-white/30">{dashboard.users.length}</span>
        </div>
        <Card className="overflow-hidden">
          {dashboard.users.length ? dashboard.users.map((user, index) => (
            <FounderUserRow key={user.id} user={user} locale={locale} t={t} divider={index > 0} />
          )) : (
            <div className="flex min-h-28 flex-col items-center justify-center gap-2 p-5 text-center">
              <UsersRound className="h-5 w-5 text-white/28" />
              <p className="text-sm text-white/42">{t("settings:founder.noUsers")}</p>
            </div>
          )}
        </Card>
      </section>
    </>
  );
}

function FounderUserRow({
  user,
  locale,
  t,
  divider
}: {
  user: FounderUser;
  locale: string;
  t: ReturnType<typeof useTranslation<["settings", "common"]>>["t"];
  divider: boolean;
}) {
  const lastSeen = user.lastActiveAt ?? user.lastLoginAt;
  return (
    <article className={`px-5 py-4 ${divider ? "border-t border-white/[0.06]" : ""}`}>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{user.email}</p>
          <p className="mt-1 text-xs text-white/34">
            {t("settings:founder.joined", { date: formatDateTime(user.registeredAt, locale) })}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-white/42">
          {user.emailVerified ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
          {user.emailVerified ? t("settings:founder.verified") : t("settings:founder.unverified")}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/42">
        <span>{t("settings:founder.lastActive", { date: lastSeen ? formatDateTime(lastSeen, locale) : "—" })}</span>
        <span>{t("settings:founder.userCounts", {
          employments: user.employmentCount,
          types: user.workTypeCount,
          sessions: user.workSessionCount
        })}</span>
      </div>
    </article>
  );
}

function RegistrationChart({ points }: { points: FounderDashboard["registrations"] }) {
  const path = useMemo(() => {
    if (!points.length) return "";
    const max = Math.max(1, ...points.map((point) => point.registrations));
    return points.map((point, index) => {
      const x = points.length === 1 ? 50 : (index / (points.length - 1)) * 100;
      const y = 36 - (point.registrations / max) * 32;
      return `${index ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(" ");
  }, [points]);

  return (
    <svg viewBox="0 0 100 40" className="h-28 w-full overflow-visible" preserveAspectRatio="none" role="img" aria-label="Registrations over 30 days">
      <path d="M0,36 H100" stroke="rgba(255,255,255,0.08)" strokeWidth="0.6" />
      <path d={path} fill="none" stroke="rgba(255,255,255,0.86)" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function FounderSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3" aria-label="Loading founder dashboard">
      {Array.from({ length: 6 }, (_, index) => (
        <Card key={index} className="h-24 animate-pulse bg-white/[0.04]" />
      ))}
    </div>
  );
}

function formatShortDate(value: string | undefined, locale: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short" }).format(new Date(`${value}T12:00:00`));
}

function formatDateTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

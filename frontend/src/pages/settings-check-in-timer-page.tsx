import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleStop, Clock3, LogIn, LogOut, Play } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { getApiError } from "../api/api-errors";
import { getEmployment, updateEmployment, type EmploymentPayload } from "../api/endpoints";
import { queryKeys } from "../api/query-keys";
import { SettingsGroup } from "../components/settings/settings-group";
import { SettingsNavigationHeader } from "../components/settings/settings-navigation-header";
import { SettingsPageSkeleton } from "../components/settings/settings-page-skeleton";
import { Card } from "../components/ui/card";
import { ScreenMessage } from "../components/ui/screen-message";
import { useSafeBackNavigation } from "../hooks/use-safe-back-navigation";
import type { Employment } from "../types/configuration";

export function SettingsCheckInTimerPage() {
  const { employmentId = "" } = useParams();
  const { t } = useTranslation(["settings", "common"]);
  const queryClient = useQueryClient();
  const safeBack = useSafeBackNavigation({ fallback: `/settings/employment/${employmentId}` });
  const employmentQuery = useQuery({
    queryKey: queryKeys.employments.detail(employmentId),
    queryFn: () => getEmployment(employmentId),
    enabled: Boolean(employmentId)
  });
  const timerMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      updateEmployment(employmentId, timerPayload(employmentQuery.data!, enabled)),
    onSuccess: async (employment) => {
      queryClient.setQueryData(queryKeys.employments.detail(employment.id), employment);
      await queryClient.invalidateQueries({ queryKey: queryKeys.employments.all(), exact: true });
    }
  });

  if (employmentQuery.isLoading) return <SettingsPageSkeleton />;
  if (!employmentQuery.data || employmentQuery.error) {
    return (
      <ScreenMessage
        title={t("settings:employment.unavailableTitle")}
        description={employmentQuery.error
          ? getApiError(employmentQuery.error).message
          : t("settings:employment.unavailableDescription")}
      />
    );
  }

  const employment = employmentQuery.data;
  const enabled = employment.timerEnabled ?? employment.trackingFocus === "TIME";

  return (
    <div className="mx-auto w-full max-w-[560px] space-y-6 pb-10 pt-8">
      <SettingsNavigationHeader
        title={t("settings:employment.fields.timer")}
        backLabel={t("common:actions.back")}
        onBack={safeBack}
      />

      <SettingsGroup title={t("settings:employment.sections.timeEntry")}>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={timerMutation.isPending}
          onClick={() => timerMutation.mutate(!enabled)}
          className="flex min-h-16 w-full items-center justify-between gap-4 px-5 py-3 text-left disabled:opacity-55"
        >
          <span className="min-w-0">
            <span className="block text-[1rem] tracking-[-0.02em] text-white">
              {t("settings:employment.fields.timer")}
            </span>
            <span className="mt-1 block text-xs leading-5 text-white/42">
              {t("settings:employment.help.timer")}
            </span>
          </span>
          <ToggleIndicator enabled={enabled} />
        </button>
        {timerMutation.error ? (
          <p className="px-5 pb-3 text-sm text-red-300">{getApiError(timerMutation.error).message}</p>
        ) : null}
      </SettingsGroup>

      <SettingsGroup
        title={t("settings:employment.timerPreview.label")}
        description={t("settings:employment.timerPreview.description")}
      >
        <CheckInTimerPreview />
      </SettingsGroup>

      <section className="space-y-2">
        <p className="hairline-text">{t("settings:employment.timerPreview.demoLabel")}</p>
        <CheckInTimerCardDemo />
      </section>
    </div>
  );
}

function CheckInTimerPreview() {
  const { t } = useTranslation("settings");
  const steps = [
    { key: "checkIn", icon: LogIn },
    { key: "tracking", icon: Clock3 },
    { key: "checkOut", icon: LogOut }
  ] as const;

  return (
    <div className="px-5 pb-5 pt-5">
      <div className="relative">
        <div className="absolute left-[16.66%] right-[16.66%] top-5 h-px bg-white/[0.10]" aria-hidden="true">
          <span className="check-in-preview-line block h-full origin-left bg-emerald-400" />
          <span className="check-in-preview-dot absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.75)]" />
        </div>
        <div className="relative grid grid-cols-3 gap-2">
          {steps.map(({ key, icon: Icon }, index) => (
            <div key={key} className="flex min-w-0 flex-col items-center text-center">
              <span className={`check-in-preview-step check-in-preview-step-${index + 1} grid h-10 w-10 place-items-center rounded-full border border-white/[0.10] bg-[#111] text-white/45`}>
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="mt-2 text-xs font-medium text-white/72">
                {t(`employment.timerPreview.${key}`)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CheckInTimerCardDemo() {
  const { t } = useTranslation(["settings", "dashboard"]);
  const [running, setRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!running) return;
    const interval = window.setInterval(() => setElapsedSeconds((current) => current + 1), 1_000);
    return () => window.clearInterval(interval);
  }, [running]);

  const toggleDemo = () => {
    setRunning((current) => !current);
    setElapsedSeconds(0);
  };

  return (
    <Card className="overflow-hidden px-5 py-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-name truncate text-lg font-semibold tracking-[-0.04em] text-white">
            {t("settings:employment.timerPreview.demoActivity")}
          </p>
          {running ? (
            <p className="mt-3 text-4xl font-semibold tabular-nums tracking-[-0.06em] text-white">
              {formatDemoClock(elapsedSeconds)}
            </p>
          ) : null}
        </div>
        {running ? <span className="mt-1 h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-emerald-400" /> : null}
      </div>
      {running ? (
        <p className="mt-4 text-xs text-white/48">{t("settings:employment.timerPreview.recording")}</p>
      ) : null}
      <button
        type="button"
        onClick={toggleDemo}
        className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-white text-sm font-semibold text-black transition active:scale-[0.98]"
      >
        {running ? <CircleStop className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
        {t(running ? "dashboard:timeTracking.checkOut" : "dashboard:timeTracking.checkIn")}
      </button>
    </Card>
  );
}

function ToggleIndicator({ enabled }: { enabled: boolean }) {
  return (
    <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${enabled ? "bg-white" : "bg-white/[0.12]"}`} aria-hidden="true">
      <span className={`absolute top-1 h-5 w-5 rounded-full transition ${enabled ? "left-6 bg-black" : "left-1 bg-white/55"}`} />
    </span>
  );
}

function formatDemoClock(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

function timerPayload(employment: Employment, timerEnabled: boolean): EmploymentPayload {
  return {
    name: employment.name,
    employmentType: null,
    compensationType: employment.compensationType,
    trackingFocus: employment.trackingFocus,
    hourBalanceEnabled: employment.hourBalanceEnabled,
    timerEnabled,
    termsValidFrom: employment.termsValidFrom,
    startDate: employment.startDate,
    endDate: employment.endDate,
    fixedSalaryAmount: employment.fixedSalaryAmount ? Number(employment.fixedSalaryAmount) : null,
    currency: employment.currency,
    targetMinutes: employment.targetMinutes,
    targetPeriod: employment.targetPeriod,
    hourBalanceValidityMonths: employment.hourBalanceValidityMonths,
    active: employment.active,
    displayOrder: employment.displayOrder
  };
}

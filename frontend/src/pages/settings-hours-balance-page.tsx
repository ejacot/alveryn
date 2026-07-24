import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Clock3, Target } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { getApiError } from "../api/api-errors";
import { getEmployment, updateEmployment, type EmploymentPayload } from "../api/endpoints";
import { queryKeys } from "../api/query-keys";
import { SettingsGroup } from "../components/settings/settings-group";
import { SettingsNavigationHeader } from "../components/settings/settings-navigation-header";
import { SettingsPageSkeleton } from "../components/settings/settings-page-skeleton";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { ScreenMessage } from "../components/ui/screen-message";
import { Select } from "../components/ui/select";
import { useSafeBackNavigation } from "../hooks/use-safe-back-navigation";
import type { Employment, TargetPeriod } from "../types/configuration";
import { todayLocalIsoDate } from "../utils/date";

export function SettingsHoursBalancePage() {
  const { employmentId = "" } = useParams();
  const { t } = useTranslation(["settings", "common"]);
  const queryClient = useQueryClient();
  const safeBack = useSafeBackNavigation({ fallback: `/settings/employment/${employmentId}` });
  const [enabled, setEnabled] = useState(false);
  const [targetHours, setTargetHours] = useState("160");
  const [targetPeriod, setTargetPeriod] = useState<TargetPeriod>("MONTHLY");
  const [validityMonths, setValidityMonths] = useState("12");

  const employmentQuery = useQuery({
    queryKey: queryKeys.employments.detail(employmentId),
    queryFn: () => getEmployment(employmentId),
    enabled: Boolean(employmentId)
  });

  useEffect(() => {
    if (!employmentQuery.data) return;
    setEnabled(employmentQuery.data.hourBalanceEnabled);
    setTargetHours(employmentQuery.data.targetMinutes
      ? String(employmentQuery.data.targetMinutes / 60)
      : "160");
    setTargetPeriod(employmentQuery.data.targetPeriod ?? "MONTHLY");
    setValidityMonths(String(employmentQuery.data.hourBalanceValidityMonths ?? 12));
  }, [employmentQuery.data]);

  const normalizedTargetHours = Number(targetHours);
  const normalizedValidityMonths = Number(validityMonths);
  const valid = !enabled || (
    Number.isFinite(normalizedTargetHours)
    && normalizedTargetHours > 0
    && Number.isInteger(normalizedValidityMonths)
    && normalizedValidityMonths > 0
  );
  const unchanged = employmentQuery.data
    ? enabled === employmentQuery.data.hourBalanceEnabled
      && (!enabled || (
        Math.round(normalizedTargetHours * 60) === employmentQuery.data.targetMinutes
        && targetPeriod === employmentQuery.data.targetPeriod
        && normalizedValidityMonths === employmentQuery.data.hourBalanceValidityMonths
      ))
    : true;

  const saveMutation = useMutation({
    mutationFn: (nextEnabled: boolean) => updateEmployment(
      employmentId,
      balancePayload(
        employmentQuery.data!,
        nextEnabled,
        normalizedTargetHours,
        targetPeriod,
        normalizedValidityMonths
      )
    ),
    onSuccess: async (employment) => {
      queryClient.setQueryData(queryKeys.employments.detail(employment.id), employment);
      await queryClient.invalidateQueries({ queryKey: queryKeys.employments.all(), exact: true });
      setEnabled(employment.hourBalanceEnabled);
    },
    onError: () => setEnabled(employmentQuery.data?.hourBalanceEnabled ?? false)
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

  return (
    <div className="mx-auto w-full max-w-[560px] space-y-6 pb-10 pt-8">
      <SettingsNavigationHeader
        title={t("settings:employment.fields.hourBalanceAccount")}
        backLabel={t("common:actions.back")}
        onBack={safeBack}
      />

      <SettingsGroup title={t("settings:employment.sections.hourBalanceAccount")}>
        <div className="space-y-4 px-5 py-4">
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            disabled={saveMutation.isPending}
            onClick={() => {
              if (enabled && employmentQuery.data.hourBalanceEnabled) {
                setEnabled(false);
                saveMutation.mutate(false);
                return;
              }
              setEnabled((current) => !current);
            }}
            className="flex w-full items-center justify-between gap-4 text-left"
          >
            <span>
              <span className="block font-medium text-white">{t("settings:employment.fields.hourBalance")}</span>
              <span className="mt-1 block text-sm leading-5 text-white/46">{t("settings:employment.help.hourBalance")}</span>
            </span>
            <ToggleIndicator enabled={enabled} />
          </button>
          {enabled ? (
            <div className="space-y-4 border-t border-white/[0.08] pt-4">
              <Input
                type="number"
                min="0.01"
                step="0.01"
                label={t("settings:employment.fields.targetHours")}
                helperText={t("settings:employment.help.targetHours")}
                value={targetHours}
                onChange={(event) => setTargetHours(event.currentTarget.value)}
              />
              <Select
                label={t("settings:employment.fields.targetPeriod")}
                value={targetPeriod}
                onChange={(event) => setTargetPeriod(event.currentTarget.value as TargetPeriod)}
              >
                <option value="WEEKLY">{t("settings:employment.targetPeriods.WEEKLY")}</option>
                <option value="MONTHLY">{t("settings:employment.targetPeriods.MONTHLY")}</option>
              </Select>
              <Input
                type="number"
                min="1"
                step="1"
                label={t("settings:employment.fields.validityMonths")}
                helperText={t("settings:employment.help.validityMonths")}
                value={validityMonths}
                onChange={(event) => setValidityMonths(event.currentTarget.value)}
              />
            </div>
          ) : null}
          {!valid ? <p className="text-sm text-red-300">{t("settings:employment.validation.timeConfiguration")}</p> : null}
          {enabled ? (
            <Button
              className="w-full bg-white text-black hover:bg-white/90"
              disabled={!valid || unchanged || saveMutation.isPending}
              onClick={() => saveMutation.mutate(true)}
            >
              {saveMutation.isPending ? t("common:actions.working") : t("common:actions.save")}
            </Button>
          ) : null}
          {saveMutation.error ? <p className="text-sm text-red-300">{getApiError(saveMutation.error).message}</p> : null}
        </div>
      </SettingsGroup>

      <SettingsGroup
        title={t("settings:employment.balancePreview.label")}
        description={t("settings:employment.balancePreview.description")}
      >
        <BalanceExplanation />
      </SettingsGroup>

      <section className="space-y-2">
        <p className="hairline-text">{t("settings:employment.balancePreview.cardLabel")}</p>
        <BalanceCard />
      </section>
    </div>
  );
}

function BalanceExplanation() {
  const { t } = useTranslation("settings");
  const steps = [
    { key: "target", icon: Target, value: "40 h" },
    { key: "worked", icon: Clock3, value: "42 h 30" },
    { key: "balance", icon: ArrowRight, value: "+2 h 30" }
  ] as const;

  return (
    <div className="grid grid-cols-3 gap-2 px-4 py-5">
      {steps.map(({ key, icon: Icon, value }, index) => (
        <div key={key} className="min-w-0 text-center">
          <span className={`balance-preview-step balance-preview-step-${index + 1} mx-auto grid h-10 w-10 place-items-center rounded-full border border-white/[0.10] bg-[#111] text-white/45`}>
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <p className="mt-2 text-xs text-white/45">{t(`employment.balancePreview.${key}`)}</p>
          <p className={`mt-1 text-sm font-semibold ${key === "balance" ? "text-emerald-400" : "text-white"}`}>{value}</p>
        </div>
      ))}
    </div>
  );
}

function BalanceCard() {
  const { t } = useTranslation("settings");
  return (
    <Card className="overflow-hidden px-5 py-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="hairline-text">{t("employment.balancePreview.currentBalance")}</p>
          <p className="mt-2 text-[2.1rem] font-semibold leading-none tracking-[-0.06em] text-emerald-400">+2 h 30 min</p>
        </div>
        <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-400">
          {t("employment.balancePreview.ahead")}
        </span>
      </div>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.08]">
        <span className="balance-preview-bar block h-full rounded-full bg-emerald-400" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-white/42">{t("employment.balancePreview.worked")}</p>
          <p className="mt-1 text-lg font-semibold text-white">42 h 30 min</p>
        </div>
        <div>
          <p className="text-xs text-white/42">{t("employment.balancePreview.target")}</p>
          <p className="mt-1 text-lg font-semibold text-white">40 h</p>
        </div>
      </div>
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

function balancePayload(
  employment: Employment,
  enabled: boolean,
  targetHours: number,
  targetPeriod: TargetPeriod,
  validityMonths: number
): EmploymentPayload {
  return {
    name: employment.name,
    employmentType: null,
    compensationType: employment.compensationType,
    trackingFocus: employment.trackingFocus,
    hourBalanceEnabled: enabled,
    timerEnabled: employment.timerEnabled,
    termsValidFrom: todayLocalIsoDate(),
    startDate: employment.startDate,
    endDate: employment.endDate,
    fixedSalaryAmount: employment.fixedSalaryAmount ? Number(employment.fixedSalaryAmount) : null,
    currency: employment.currency,
    targetMinutes: enabled ? Math.round(targetHours * 60) : null,
    targetPeriod: enabled ? targetPeriod : null,
    hourBalanceValidityMonths: enabled ? validityMonths : null,
    active: employment.active,
    displayOrder: employment.displayOrder
  };
}

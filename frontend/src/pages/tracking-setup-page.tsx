import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock3, WalletCards } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { getApiError } from "../api/api-errors";
import {
  completeTrackingSetup,
  createEmployment,
  listEmployments,
  updateEmployment,
  type EmploymentPayload
} from "../api/endpoints";
import { queryKeys } from "../api/query-keys";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { ScreenMessage } from "../components/ui/screen-message";
import { useAuth } from "../features/auth/use-auth";
import { APP_HOME_PATH } from "../routes/app-paths";
import type { Employment, TrackingFocus } from "../types/configuration";
import { todayLocalIsoDate } from "../utils/date";

const trackingOptions: Array<{
  value: TrackingFocus;
  icon: typeof Clock3;
}> = [
  { value: "TIME", icon: Clock3 },
  { value: "EARNINGS", icon: WalletCards }
];

export function TrackingSetupPage() {
  const { t } = useTranslation("onboarding");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, refreshCurrentUser } = useAuth();
  const [selections, setSelections] = useState<Record<string, TrackingFocus>>({});
  const [newEmploymentName, setNewEmploymentName] = useState("");
  const [newTrackingFocus, setNewTrackingFocus] = useState<TrackingFocus>("TIME");

  const employmentsQuery = useQuery({
    queryKey: queryKeys.employments.all(),
    queryFn: listEmployments
  });
  const activeEmployments = useMemo(
    () => (employmentsQuery.data ?? []).filter((employment) => employment.active),
    [employmentsQuery.data]
  );

  useEffect(() => {
    if (!activeEmployments.length) return;
    setSelections((current) => {
      const next = { ...current };
      for (const employment of activeEmployments) {
        next[employment.id] ??= employment.trackingFocus;
      }
      return next;
    });
  }, [activeEmployments]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (activeEmployments.length) {
        await Promise.all(
          activeEmployments.map((employment) =>
            updateEmployment(
              employment.id,
              employmentPayload(employment, selections[employment.id] ?? employment.trackingFocus)
            )
          )
        );
      } else {
        const name = newEmploymentName.trim();
        if (!name) throw new Error(t("trackingSetup.nameRequired"));
        await createEmployment(newEmploymentPayload(name, newTrackingFocus));
      }
      await completeTrackingSetup();
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.employments.all() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.preferences() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.trackingSetupStatus() })
      ]);
      const nextUser = await refreshCurrentUser();
      navigate(
        nextUser.preferences?.onboardingCompleted ? APP_HOME_PATH : "/onboarding",
        { replace: true }
      );
    }
  });

  if (employmentsQuery.isLoading) {
    return <ScreenMessage title={t("trackingSetup.loading")} />;
  }

  if (employmentsQuery.error) {
    return (
      <ScreenMessage
        title={t("trackingSetup.errorTitle")}
        description={getApiError(employmentsQuery.error).message}
      />
    );
  }

  return (
    <section className="pb-8 pt-6">
      <div className="mx-auto max-w-md space-y-6">
        <header className="space-y-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/42">
            {user?.preferences?.onboardingCompleted
              ? t("trackingSetup.updateLabel")
              : t("trackingSetup.setupLabel")}
          </p>
          <h1 className="font-title text-[2rem] font-semibold leading-tight text-white">
            {t("trackingSetup.title")}
          </h1>
          <p className="text-sm leading-6 text-white/58">
            {t("trackingSetup.description")}
          </p>
        </header>

        {activeEmployments.length ? (
          activeEmployments.map((employment) => (
            <Card key={employment.id} variant="section" className="space-y-4">
              <div>
                <p className="font-name text-lg font-semibold text-white">{employment.name}</p>
                <p className="mt-1 text-sm text-white/46">
                  {t("trackingSetup.chooseForEmployment")}
                </p>
              </div>
              <TrackingChoices
                value={selections[employment.id] ?? employment.trackingFocus}
                onChange={(value) =>
                  setSelections((current) => ({ ...current, [employment.id]: value }))
                }
              />
            </Card>
          ))
        ) : (
          <Card variant="section" className="space-y-5">
            <Input
              label={t("trackingSetup.employmentName")}
              value={newEmploymentName}
              maxLength={120}
              autoComplete="organization"
              onChange={(event) => setNewEmploymentName(event.currentTarget.value)}
            />
            <TrackingChoices value={newTrackingFocus} onChange={setNewTrackingFocus} />
          </Card>
        )}

        <div className="space-y-3">
          <Button
            className="w-full"
            disabled={saveMutation.isPending || (!activeEmployments.length && !newEmploymentName.trim())}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? t("trackingSetup.saving") : t("trackingSetup.continue")}
          </Button>
          {saveMutation.error ? (
            <p className="text-center text-sm text-red-300">
              {getApiError(saveMutation.error).message}
            </p>
          ) : null}
          <p className="text-center text-xs leading-5 text-white/38">
            {t("trackingSetup.changeLater")}
          </p>
        </div>
      </div>
    </section>
  );
}

function TrackingChoices({
  value,
  onChange
}: {
  value: TrackingFocus;
  onChange: (value: TrackingFocus) => void;
}) {
  const { t } = useTranslation("onboarding");

  return (
    <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label={t("trackingSetup.choiceLabel")}>
      {trackingOptions.map((option) => {
        const selected = value === option.value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={`min-h-[9rem] rounded-[1.35rem] border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-white/30 ${
              selected
                ? "border-white/55 bg-white/[0.11]"
                : "border-white/[0.09] bg-white/[0.025]"
            }`}
          >
            <span className="flex items-center justify-between gap-3">
              <Icon className="h-5 w-5 text-white/74" aria-hidden="true" />
              <span
                className={`h-4 w-4 rounded-full border ${
                  selected ? "border-[5px] border-white" : "border-white/25"
                }`}
                aria-hidden="true"
              />
            </span>
            <span className="mt-4 block font-semibold text-white">
              {t(`trackingSetup.options.${option.value}.title`)}
            </span>
            <span className="mt-1.5 block text-xs leading-5 text-white/48">
              {t(`trackingSetup.options.${option.value}.description`)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function employmentPayload(employment: Employment, trackingFocus: TrackingFocus): EmploymentPayload {
  const balanceEnabled = trackingFocus === "TIME" && employment.hourBalanceEnabled;
  const today = todayLocalIsoDate();
  return {
    name: employment.name,
    employmentType: null,
    compensationType: null,
    trackingFocus,
    hourBalanceEnabled: balanceEnabled,
    termsValidFrom: employment.termsValidFrom > today ? employment.termsValidFrom : today,
    startDate: employment.startDate,
    endDate: employment.endDate,
    fixedSalaryAmount: null,
    currency: null,
    targetMinutes: balanceEnabled ? employment.targetMinutes : null,
    targetPeriod: balanceEnabled ? employment.targetPeriod : null,
    hourBalanceValidityMonths: balanceEnabled ? employment.hourBalanceValidityMonths : null,
    active: true,
    displayOrder: employment.displayOrder
  };
}

function newEmploymentPayload(name: string, trackingFocus: TrackingFocus): EmploymentPayload {
  return {
    name,
    employmentType: null,
    compensationType: null,
    trackingFocus,
    hourBalanceEnabled: false,
    termsValidFrom: todayLocalIsoDate(),
    startDate: null,
    endDate: null,
    fixedSalaryAmount: null,
    currency: null,
    targetMinutes: null,
    targetPeriod: null,
    hourBalanceValidityMonths: null,
    active: true,
    displayOrder: null
  };
}

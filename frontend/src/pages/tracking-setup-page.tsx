import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, Boxes, Check, Clock3, PencilLine, Receipt, Timer, WalletCards } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { getApiError } from "../api/api-errors";
import {
  completeTrackingSetup,
  completeInitialSetup,
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
import type { CompensationType, Employment, TrackingFocus } from "../types/configuration";
import { firstDayOfCurrentMonthLocalIsoDate, todayLocalIsoDate } from "../utils/date";

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
      await Promise.all(
        activeEmployments.map((employment) =>
          updateEmployment(
            employment.id,
            employmentPayload(employment, selections[employment.id] ?? employment.trackingFocus)
          )
        )
      );
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

  if (!activeEmployments.length) {
    return <NewAccountSetup />;
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

        {activeEmployments.map((employment) => (
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
          ))}

        <div className="space-y-3">
          <Button
            className="w-full"
            disabled={saveMutation.isPending}
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

type TimeEntryMode = "TIMER_AND_MANUAL" | "MANUAL";

function NewAccountSetup() {
  const { t, i18n } = useTranslation("onboarding");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, refreshCurrentUser } = useAuth();
  const [step, setStep] = useState(1);
  const [firstName, setFirstName] = useState(user?.profile?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.profile?.lastName ?? "");
  const [employmentName, setEmploymentName] = useState("");
  const [startDate, setStartDate] = useState(firstDayOfCurrentMonthLocalIsoDate());
  const [compensationType, setCompensationType] = useState<CompensationType>("HOURLY");
  const [hourlyRate, setHourlyRate] = useState("");
  const [fixedSalaryAmount, setFixedSalaryAmount] = useState("");
  const [currency, setCurrency] = useState(user?.preferences?.currency ?? "EUR");
  const [timeEntryMode, setTimeEntryMode] = useState<TimeEntryMode>("TIMER_AND_MANUAL");
  const [hourBalanceEnabled, setHourBalanceEnabled] = useState(false);
  const [targetHours, setTargetHours] = useState("160");
  const [validityMonths, setValidityMonths] = useState("12");
  const [workTypeName, setWorkTypeName] = useState("");
  const [unitLabel, setUnitLabel] = useState("");
  const [unitSymbol, setUnitSymbol] = useState("");
  const [ratePerUnit, setRatePerUnit] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const supportsTimeTracking = compensationType === "HOURLY" || compensationType === "FIXED_SALARY";

  const finishMutation = useMutation({
    mutationFn: async () => {
      const preferences = user?.preferences;
      if (!preferences) throw new Error(t("setup.errors.preferences"));

      await completeInitialSetup({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        language: i18n.resolvedLanguage ?? i18n.language ?? "en",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || preferences.timezone || "UTC",
        currency,
        firstDayOfWeek: preferences.firstDayOfWeek,
        dateFormat: preferences.dateFormat,
        timeFormat: preferences.timeFormat,
        theme: preferences.theme,
        defaultBreakMinutes: preferences.defaultBreakMinutes,
        preferredDailyMinutes: preferences.preferredDailyMinutes ?? 480,
        paidSickLeave: preferences.paidSickLeave,
        paidVacation: preferences.paidVacation,
        employmentName: employmentName.trim(),
        startDate,
        compensationType,
        hourlyRate: compensationType === "HOURLY" ? parseNumber(hourlyRate) : null,
        fixedSalaryAmount: compensationType === "FIXED_SALARY" ? parseNumber(fixedSalaryAmount) : null,
        timerEnabled: supportsTimeTracking && timeEntryMode === "TIMER_AND_MANUAL",
        hourBalanceEnabled: supportsTimeTracking && (hourBalanceEnabled || compensationType === "FIXED_SALARY"),
        targetMinutes: supportsTimeTracking && (hourBalanceEnabled || compensationType === "FIXED_SALARY")
          ? Math.round(Number(targetHours) * 60) : null,
        hourBalanceValidityMonths: supportsTimeTracking && (hourBalanceEnabled || compensationType === "FIXED_SALARY")
          ? Number(validityMonths) : null,
        workTypeName: workTypeName.trim(),
        unitLabel: compensationType === "PER_UNIT" ? unitLabel.trim() : null,
        unitSymbol: compensationType === "PER_UNIT" ? unitSymbol.trim() || null : null,
        ratePerUnit: compensationType === "PER_UNIT" ? parseNumber(ratePerUnit) : null
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.employments.all() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.hourlyRates.all() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.workTypes.all() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.preferences() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.onboardingStatus() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.trackingSetupStatus() })
      ]);
      await refreshCurrentUser();
      navigate(APP_HOME_PATH, { replace: true });
    }
  });

  const next = () => {
    const error = validateSetupStep(step, {
      firstName,
      lastName,
      employmentName,
      startDate,
      compensationType,
      hourlyRate,
      fixedSalaryAmount,
      hourBalanceEnabled,
      targetHours,
      validityMonths,
      workTypeName,
      unitLabel,
      ratePerUnit
    }, t);
    setValidationError(error);
    if (!error) setStep((current) => Math.min(6, current + 1));
  };

  return (
    <section className="pb-8 pt-5">
      <div className="mx-auto max-w-md space-y-5">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.2em] text-white/45">
          <span>{t("setup.label")}</span>
          <span>{step} / 6</span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-white transition-all duration-300" style={{ width: `${step / 6 * 100}%` }} />
        </div>

        <Card variant="section" className="space-y-5 rounded-[2rem] p-6">
          {step === 1 ? (
            <>
              <SetupHeader title={t("setup.profile.title")} description={t("setup.profile.description")} />
              <Input label={t("setup.profile.firstName")} value={firstName} autoComplete="given-name" onChange={(event) => setFirstName(event.currentTarget.value)} />
              <Input label={t("setup.profile.lastName")} value={lastName} autoComplete="family-name" onChange={(event) => setLastName(event.currentTarget.value)} />
            </>
          ) : null}

          {step === 2 ? (
            <>
              <SetupHeader title={t("setup.workplace.title")} description={t("setup.workplace.description")} />
              <Input label={t("setup.workplace.name")} value={employmentName} autoComplete="organization" placeholder={t("setup.workplace.placeholder")} onChange={(event) => setEmploymentName(event.currentTarget.value)} />
              <Input label={t("setup.workplace.startDate")} type="date" value={startDate} onChange={(event) => setStartDate(event.currentTarget.value)} />
              <p className="text-xs leading-5 text-white/45">{t("setup.workplace.startDateHint")}</p>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <SetupHeader title={t("setup.payment.title")} description={t("setup.payment.description")} />
              <div className="grid grid-cols-2 gap-3">
                <ChoiceCard selected={compensationType === "HOURLY"} icon={Clock3} title={t("setup.payment.hourly.title")} description={t("setup.payment.hourly.description")} onClick={() => setCompensationType("HOURLY")} />
                <ChoiceCard selected={compensationType === "FIXED_SALARY"} icon={Banknote} title={t("setup.payment.fixed.title")} description={t("setup.payment.fixed.description")} onClick={() => setCompensationType("FIXED_SALARY")} />
                <ChoiceCard selected={compensationType === "PER_UNIT"} icon={Boxes} title={t("setup.payment.perUnit.title")} description={t("setup.payment.perUnit.description")} onClick={() => setCompensationType("PER_UNIT")} />
                <ChoiceCard selected={compensationType === "FIXED_AMOUNT"} icon={Receipt} title={t("setup.payment.fixedAmount.title")} description={t("setup.payment.fixedAmount.description")} onClick={() => setCompensationType("FIXED_AMOUNT")} />
              </div>
              {compensationType === "HOURLY" ? (
                <div className="grid grid-cols-[1fr_6.5rem] gap-3">
                  <Input label={t("setup.payment.rate")} inputMode="decimal" value={hourlyRate} placeholder="17.50" onChange={(event) => setHourlyRate(event.currentTarget.value)} />
                  <Input label={t("setup.payment.currency")} value={currency} maxLength={3} onChange={(event) => setCurrency(event.currentTarget.value.toUpperCase())} />
                </div>
              ) : null}
              {compensationType === "FIXED_SALARY" ? (
                <div className="grid grid-cols-[1fr_6.5rem] gap-3">
                  <Input label={t("setup.payment.salary")} inputMode="decimal" value={fixedSalaryAmount} placeholder="3000" onChange={(event) => setFixedSalaryAmount(event.currentTarget.value)} />
                  <Input label={t("setup.payment.currency")} value={currency} maxLength={3} onChange={(event) => setCurrency(event.currentTarget.value.toUpperCase())} />
                </div>
              ) : null}
            </>
          ) : null}

          {step === 4 ? (
            <>
              <SetupHeader title={t("setup.timeEntry.title")} description={t("setup.timeEntry.description")} />
              {supportsTimeTracking ? (
                <div className="space-y-3">
                  <ChoiceCard horizontal selected={timeEntryMode === "TIMER_AND_MANUAL"} icon={Timer} title={t("setup.timeEntry.timer.title")} description={t("setup.timeEntry.timer.description")} onClick={() => setTimeEntryMode("TIMER_AND_MANUAL")} />
                  <ChoiceCard horizontal selected={timeEntryMode === "MANUAL"} icon={PencilLine} title={t("setup.timeEntry.manual.title")} description={t("setup.timeEntry.manual.description")} onClick={() => setTimeEntryMode("MANUAL")} />
                </div>
              ) : (
                <ChoiceCard horizontal selected icon={PencilLine} title={t("setup.timeEntry.job.title")} description={t("setup.timeEntry.job.description")} onClick={() => setTimeEntryMode("MANUAL")} />
              )}
            </>
          ) : null}

          {step === 5 ? (
            <>
              <SetupHeader title={t("setup.balance.title")} description={t("setup.balance.description")} />
              {supportsTimeTracking ? (
                <div className="grid grid-cols-2 gap-3">
                  <ChoiceCard selected={!hourBalanceEnabled && compensationType !== "FIXED_SALARY"} title={t("setup.balance.no.title")} description={t("setup.balance.no.description")} onClick={() => setHourBalanceEnabled(false)} />
                  <ChoiceCard selected={hourBalanceEnabled || compensationType === "FIXED_SALARY"} title={t("setup.balance.yes.title")} description={t("setup.balance.yes.description")} onClick={() => setHourBalanceEnabled(true)} />
                </div>
              ) : (
                <ChoiceCard horizontal selected title={t("setup.balance.notNeeded.title")} description={t("setup.balance.notNeeded.description")} onClick={() => setHourBalanceEnabled(false)} />
              )}
              {supportsTimeTracking && (hourBalanceEnabled || compensationType === "FIXED_SALARY") ? (
                <Input label={t("setup.balance.target")} type="number" inputMode="decimal" min="1" value={targetHours} onChange={(event) => setTargetHours(event.currentTarget.value)} helperText={t("setup.balance.targetHint")} />
              ) : null}
              {supportsTimeTracking && hourBalanceEnabled ? (
                <Input label={t("setup.balance.validity")} type="number" inputMode="numeric" min="1" value={validityMonths} onChange={(event) => setValidityMonths(event.currentTarget.value)} helperText={t("setup.balance.validityHint")} />
              ) : null}
            </>
          ) : null}

          {step === 6 ? (
            <>
              <SetupHeader title={t("setup.workType.title")} description={t("setup.workType.description")} />
              <Input label={t("setup.workType.name")} value={workTypeName} placeholder={t("setup.workType.placeholder")} onChange={(event) => setWorkTypeName(event.currentTarget.value)} />
              {compensationType === "PER_UNIT" ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Input label={t("setup.workType.unitLabel")} value={unitLabel} placeholder="Room" onChange={(event) => setUnitLabel(event.currentTarget.value)} />
                    <Input label={t("setup.workType.unitSymbol")} value={unitSymbol} placeholder="room" onChange={(event) => setUnitSymbol(event.currentTarget.value)} />
                  </div>
                  <div className="grid grid-cols-[1fr_6.5rem] gap-3">
                    <Input label={t("setup.workType.ratePerUnit")} inputMode="decimal" value={ratePerUnit} placeholder="25" onChange={(event) => setRatePerUnit(event.currentTarget.value)} />
                    <Input label={t("setup.payment.currency")} value={currency} maxLength={3} onChange={(event) => setCurrency(event.currentTarget.value.toUpperCase())} />
                  </div>
                </>
              ) : null}
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm text-white/62">
                {t("setup.workType.colorHint")}
              </div>
            </>
          ) : null}

          {validationError ? <p className="text-sm text-red-300">{validationError}</p> : null}
          {finishMutation.error ? <p className="text-sm text-red-300">{getApiError(finishMutation.error).message}</p> : null}

          <div className={`grid gap-3 ${step > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
            {step > 1 ? <Button variant="ghost" onClick={() => { setValidationError(null); setStep((current) => current - 1); }}>{t("setup.actions.back")}</Button> : null}
            <Button disabled={finishMutation.isPending} onClick={() => step === 6 ? finishMutation.mutate() : next()}>
              {finishMutation.isPending ? t("setup.actions.saving") : step === 6 ? t("setup.actions.finish") : t("setup.actions.continue")}
            </Button>
          </div>
        </Card>
      </div>
    </section>
  );
}

function SetupHeader({ title, description }: { title: string; description: string }) {
  return <div className="space-y-2"><h1 className="font-title text-[1.75rem] font-semibold leading-tight text-white">{title}</h1><p className="text-sm leading-6 text-white/56">{description}</p></div>;
}

function ChoiceCard({ selected, icon: Icon, title, description, onClick, horizontal = false }: {
  selected: boolean;
  icon?: typeof Clock3;
  title: string;
  description: string;
  onClick: () => void;
  horizontal?: boolean;
}) {
  return (
    <button type="button" role="radio" aria-checked={selected} onClick={onClick} className={`relative rounded-[1.35rem] border p-4 text-left transition active:scale-[0.985] ${horizontal ? "min-h-[6.5rem] w-full" : "min-h-[9rem]"} ${selected ? "border-white/55 bg-white/[0.12]" : "border-white/10 bg-white/[0.025]"}`}>
      <span className="flex items-center justify-between gap-3">
        {Icon ? <Icon className="h-5 w-5 text-white/72" aria-hidden="true" /> : <span />}
        <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${selected ? "border-white bg-white text-black" : "border-white/25"}`}>{selected ? <Check className="h-3.5 w-3.5" /> : null}</span>
      </span>
      <span className="mt-3 block font-semibold text-white">{title}</span>
      <span className="mt-1 block text-xs leading-5 text-white/48">{description}</span>
    </button>
  );
}

function validateSetupStep(step: number, values: {
  firstName: string; lastName: string; employmentName: string; startDate: string;
  compensationType: CompensationType; hourlyRate: string; fixedSalaryAmount: string; hourBalanceEnabled: boolean;
  targetHours: string; validityMonths: string; workTypeName: string; unitLabel: string; ratePerUnit: string;
}, t: (key: string) => string) {
  if (step === 1 && (!values.firstName.trim() || !values.lastName.trim())) return t("setup.errors.name");
  if (step === 2 && (!values.employmentName.trim() || !values.startDate)) return t("setup.errors.workplace");
  if (step === 3 && values.compensationType === "HOURLY" && (!(Number(values.hourlyRate.replace(",", ".")) >= 0))) return t("setup.errors.rate");
  if (step === 3 && values.compensationType === "FIXED_SALARY" && (!(Number(values.fixedSalaryAmount.replace(",", ".")) >= 0))) return t("setup.errors.salary");
  const supportsTimeTracking = values.compensationType === "HOURLY" || values.compensationType === "FIXED_SALARY";
  if (step === 5 && supportsTimeTracking && (values.hourBalanceEnabled || values.compensationType === "FIXED_SALARY") && !(Number(values.targetHours) > 0)) return t("setup.errors.target");
  if (step === 5 && supportsTimeTracking && values.hourBalanceEnabled && !(Number(values.validityMonths) > 0)) return t("setup.errors.validity");
  if (step === 6 && !values.workTypeName.trim()) return t("setup.errors.workType");
  if (step === 6 && values.compensationType === "PER_UNIT" && (!values.unitLabel.trim() || !(parseNumber(values.ratePerUnit) > 0))) return t("setup.errors.perUnit");
  return null;
}

function parseNumber(value: string) {
  return Number(value.replace(",", "."));
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
  const balanceEnabled = employment.hourBalanceEnabled;
  const today = todayLocalIsoDate();
  return {
    name: employment.name,
    employmentType: null,
    compensationType: employment.compensationType,
    trackingFocus,
    hourBalanceEnabled: balanceEnabled,
    timerEnabled: employment.timerEnabled ?? trackingFocus === "TIME",
    termsValidFrom: employment.termsValidFrom > today ? employment.termsValidFrom : today,
    startDate: employment.startDate,
    endDate: employment.endDate,
    fixedSalaryAmount: employment.fixedSalaryAmount ? Number(employment.fixedSalaryAmount) : null,
    currency: employment.currency,
    targetMinutes: balanceEnabled ? employment.targetMinutes : null,
    targetPeriod: balanceEnabled ? employment.targetPeriod : null,
    hourBalanceValidityMonths: balanceEnabled ? employment.hourBalanceValidityMonths : null,
    active: true,
    displayOrder: employment.displayOrder
  };
}

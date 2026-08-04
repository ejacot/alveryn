import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, Check, Clock3, WalletCards } from "lucide-react";
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
import { Select } from "../components/ui/select";
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

const CURRENCY_OPTIONS = ["EUR", "USD", "GBP", "CHF", "PLN", "RON"];

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

type InitialCompensationType = Extract<CompensationType, "HOURLY" | "FIXED_SALARY">;

function NewAccountSetup() {
  const { t, i18n } = useTranslation("onboarding");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, refreshCurrentUser } = useAuth();
  const [step, setStep] = useState(1);
  const [firstName, setFirstName] = useState(user?.profile?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.profile?.lastName ?? "");
  const employmentName = t("setup.workplace.defaultName");
  const startDate = firstDayOfCurrentMonthLocalIsoDate();
  const [compensationType, setCompensationType] = useState<InitialCompensationType>("HOURLY");
  const [hourlyRate, setHourlyRate] = useState("");
  const [fixedSalaryAmount, setFixedSalaryAmount] = useState("");
  const [currency, setCurrency] = useState(user?.preferences?.currency ?? "EUR");
  const workTypeName = t("setup.timeEntry.preview.regularShift");
  const [paidSickLeave, setPaidSickLeave] = useState(
    user?.preferences?.paidSickLeave ?? true
  );
  const [sickLeavePaidHours, setSickLeavePaidHours] = useState(
    String((user?.preferences?.preferredDailyMinutes ?? 480) / 60)
  );
  const [paidVacation, setPaidVacation] = useState(
    user?.preferences?.paidVacation ?? true
  );
  const [vacationPaidHours, setVacationPaidHours] = useState(
    String((user?.preferences?.preferredDailyMinutes ?? 480) / 60)
  );
  const [validationError, setValidationError] = useState<string | null>(null);

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
        paidSickLeave,
        sickLeavePaidMinutesPerDay: paidSickLeave ? Math.round(parseNumber(sickLeavePaidHours) * 60) : 0,
        paidVacation,
        vacationPaidMinutesPerDay: paidVacation ? Math.round(parseNumber(vacationPaidHours) * 60) : 0,
        employmentName: employmentName.trim(),
        startDate,
        compensationType,
        hourlyRate: compensationType === "HOURLY" ? parseNumber(hourlyRate) : null,
        fixedSalaryAmount: compensationType === "FIXED_SALARY" ? parseNumber(fixedSalaryAmount) : null,
        timerEnabled: false,
        hourBalanceEnabled: compensationType === "FIXED_SALARY",
        targetMinutes: compensationType === "FIXED_SALARY" ? 160 * 60 : null,
        hourBalanceValidityMonths: compensationType === "FIXED_SALARY" ? 12 : null,
        workTypeName: workTypeName.trim(),
        unitLabel: null,
        unitSymbol: null,
        ratePerUnit: null
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
      compensationType,
      hourlyRate,
      fixedSalaryAmount,
      paidSickLeave,
      sickLeavePaidHours,
      paidVacation,
      vacationPaidHours
    }, t);
    setValidationError(error);
    if (!error) {
      if (step === 3) finishMutation.mutate();
      else setStep((current) => Math.min(3, current + 1));
    }
  };

  return (
    <section className="pb-8 pt-5">
      <div className="mx-auto max-w-md space-y-5">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.2em] text-white/45">
          <span>{t("setup.label")}</span>
          <span>{step} / 3</span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-white transition-all duration-300" style={{ width: `${step / 3 * 100}%` }} />
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
              <SetupHeader title={t("setup.payment.title")} />
              <div className="grid grid-cols-2 gap-3">
                <ChoiceCard compact selected={compensationType === "HOURLY"} icon={Clock3} title={t("setup.payment.hourly.title")} description={t("setup.payment.hourly.description")} onClick={() => setCompensationType("HOURLY")} />
                <ChoiceCard compact selected={compensationType === "FIXED_SALARY"} icon={Banknote} title={t("setup.payment.fixed.title")} description={t("setup.payment.fixed.description")} onClick={() => setCompensationType("FIXED_SALARY")} />
              </div>
              {compensationType === "HOURLY" ? (
                <div className="grid grid-cols-[1fr_6.5rem] gap-3">
                  <Input label={t("setup.payment.rate")} inputMode="decimal" value={hourlyRate} placeholder=".../h" onChange={(event) => setHourlyRate(event.currentTarget.value)} />
                  <Select label={t("setup.payment.currency")} value={currency} onChange={(event) => setCurrency(event.currentTarget.value)}>
                    {CURRENCY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </Select>
                </div>
              ) : null}
              {compensationType === "FIXED_SALARY" ? (
                <div className="grid grid-cols-[1fr_6.5rem] gap-3">
                  <Input label={t("setup.payment.salary")} inputMode="decimal" value={fixedSalaryAmount} placeholder=".../month" onChange={(event) => setFixedSalaryAmount(event.currentTarget.value)} />
                  <Select label={t("setup.payment.currency")} value={currency} onChange={(event) => setCurrency(event.currentTarget.value)}>
                    {CURRENCY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </Select>
                </div>
              ) : null}
            </>
          ) : null}

          {step === 3 ? (
            <>
              <SetupHeader
                title={t("setup.absences.title")}
                description={t("setup.absences.description")}
              />
              <PaidAbsenceChoice
                title={t("setup.absences.sick")}
                paid={paidSickLeave}
                onChange={setPaidSickLeave}
                paidHours={sickLeavePaidHours}
                onPaidHoursChange={setSickLeavePaidHours}
                t={t}
              />
              <PaidAbsenceChoice
                title={t("setup.absences.vacation")}
                paid={paidVacation}
                onChange={setPaidVacation}
                paidHours={vacationPaidHours}
                onPaidHoursChange={setVacationPaidHours}
                t={t}
              />
            </>
          ) : null}

          {validationError ? <p className="text-sm text-red-300">{validationError}</p> : null}
          {finishMutation.error ? <p className="text-sm text-red-300">{getApiError(finishMutation.error).message}</p> : null}

          <div className={`grid gap-3 ${step > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
            {step > 1 ? <Button variant="ghost" onClick={() => { setValidationError(null); setStep((current) => current - 1); }}>{t("setup.actions.back")}</Button> : null}
            <Button disabled={finishMutation.isPending} onClick={next}>
              {finishMutation.isPending ? t("setup.actions.saving") : step === 3 ? t("setup.actions.finish") : t("setup.actions.continue")}
            </Button>
          </div>
        </Card>
      </div>
    </section>
  );
}

function SetupHeader({ title, description }: { title: string; description?: string }) {
  return <div className="space-y-2"><h1 className="font-title text-[1.75rem] font-semibold leading-tight text-white">{title}</h1>{description ? <p className="text-sm leading-6 text-white/56">{description}</p> : null}</div>;
}

function ChoiceCard({ selected, icon: Icon, title, description, onClick, horizontal = false, compact = false }: {
  selected: boolean;
  icon?: typeof Clock3;
  title: string;
  description: string;
  onClick: () => void;
  horizontal?: boolean;
  compact?: boolean;
}) {
  return (
    <button type="button" role="radio" aria-checked={selected} onClick={onClick} className={`relative rounded-[1.35rem] border text-left transition active:scale-[0.985] ${compact ? "min-h-[7.25rem] p-3.5" : horizontal ? "min-h-[6.5rem] w-full p-4" : "min-h-[9rem] p-4"} ${selected ? "border-white/55 bg-white/[0.12]" : "border-white/10 bg-white/[0.025]"}`}>
      <span className="flex items-center justify-between gap-3">
        {Icon ? <Icon className="h-5 w-5 text-white/72" aria-hidden="true" /> : <span />}
        <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${selected ? "border-white bg-white text-black" : "border-white/25"}`}>{selected ? <Check className="h-3.5 w-3.5" /> : null}</span>
      </span>
      <span className={`${compact ? "mt-2 text-sm" : "mt-3"} block font-semibold text-white`}>{title}</span>
      <span className={`mt-1 block text-xs text-white/48 ${compact ? "leading-4" : "leading-5"}`}>{description}</span>
    </button>
  );
}

function PaidAbsenceChoice({
  title,
  paid,
  onChange,
  paidHours,
  onPaidHoursChange,
  t
}: {
  title: string;
  paid: boolean;
  onChange: (paid: boolean) => void;
  paidHours: string;
  onPaidHoursChange: (hours: string) => void;
  t: (key: string) => string;
}) {
  return (
    <section className="space-y-3 rounded-[1.35rem] border border-white/[0.08] bg-white/[0.025] p-3.5">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 font-semibold text-white">{title}</p>
        <div className="grid w-[11rem] shrink-0 grid-cols-2 gap-2" role="radiogroup" aria-label={title}>
        {([true, false] as const).map((value) => (
          <button
            key={String(value)}
            type="button"
            role="radio"
            aria-checked={paid === value}
            onClick={() => onChange(value)}
            className={`min-h-11 rounded-xl border px-3 text-sm font-semibold transition ${
              paid === value
                ? "border-white/45 bg-white/[0.12] text-white"
                : "border-white/[0.07] text-white/46"
            }`}
          >
            {t(value ? "setup.absences.paid" : "setup.absences.unpaid")}
          </button>
        ))}
        </div>
      </div>
      {paid ? (
        <Input
          label={t("setup.absences.paidHours")}
          type="number"
          inputMode="decimal"
          min="0.25"
          max="24"
          step="0.25"
          value={paidHours}
          onChange={(event) => onPaidHoursChange(event.currentTarget.value)}
        />
      ) : null}
    </section>
  );
}

function validateSetupStep(step: number, values: {
  firstName: string; lastName: string;
  compensationType: InitialCompensationType; hourlyRate: string; fixedSalaryAmount: string;
  paidSickLeave: boolean; sickLeavePaidHours: string; paidVacation: boolean; vacationPaidHours: string;
}, t: (key: string) => string) {
  if (step === 1 && (!values.firstName.trim() || !values.lastName.trim())) return t("setup.errors.name");
  if (step === 2 && values.compensationType === "HOURLY" && (!(Number(values.hourlyRate.replace(",", ".")) >= 0))) return t("setup.errors.rate");
  if (step === 2 && values.compensationType === "FIXED_SALARY" && (!(Number(values.fixedSalaryAmount.replace(",", ".")) >= 0))) return t("setup.errors.salary");
  if (step === 3 && values.paidSickLeave && !validPaidHours(values.sickLeavePaidHours)) return t("setup.errors.paidHours");
  if (step === 3 && values.paidVacation && !validPaidHours(values.vacationPaidHours)) return t("setup.errors.paidHours");
  return null;
}

function parseNumber(value: string) {
  return Number(value.replace(",", "."));
}

function validPaidHours(value: string) {
  const hours = parseNumber(value);
  return hours > 0 && hours <= 24;
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

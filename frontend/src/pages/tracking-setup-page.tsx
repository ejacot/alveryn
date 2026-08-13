import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronLeft, Clock3, Languages, LoaderCircle, Moon, Sun, WalletCards } from "lucide-react";
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
import { ScreenMessage } from "../components/ui/screen-message";
import { AppLogo } from "../components/branding/app-logo";
import { useAuth } from "../features/auth/use-auth";
import { clearInitialSetupDraft, getInitialSetupDraft, storeInitialSetupDraft, type InitialSetupDraft } from "../features/onboarding/onboarding-storage";
import { applyAppLanguage, i18n as appI18n } from "../i18n";
import { getNativeLanguageName, normalizeLanguage, storeLanguagePreference, SUPPORTED_LANGUAGES } from "../i18n/language";
import { APP_HOME_PATH } from "../routes/app-paths";
import type { CompensationType, Employment, TrackingFocus } from "../types/configuration";
import { firstDayOfCurrentMonthLocalIsoDate, todayLocalIsoDate } from "../utils/date";
import { applyAppTheme } from "../utils/theme";

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

type InitialCompensationType = Extract<CompensationType, "HOURLY" | "PER_UNIT" | "FIXED_AMOUNT">;

function NewAccountSetup() {
  const { t, i18n } = useTranslation("onboarding");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, refreshCurrentUser } = useAuth();
  const userId = user?.account.id ?? "";
  const restored = useMemo(() => userId ? getInitialSetupDraft(userId) : null, [userId]);
  const [step, setStep] = useState<1 | 2 | 3>(restored?.step ?? 1);
  const [firstName, setFirstName] = useState(restored?.firstName ?? user?.profile?.firstName ?? "");
  const [lastName, setLastName] = useState(restored?.lastName ?? user?.profile?.lastName ?? "");
  const [compensationType, setCompensationType] = useState<InitialCompensationType>(restored?.compensationType ?? "HOURLY");
  const [hourlyRate, setHourlyRate] = useState(restored?.hourlyRate ?? "");
  const [unitLabel, setUnitLabel] = useState(restored?.unitLabel ?? "m²");
  const [ratePerUnit, setRatePerUnit] = useState(restored?.ratePerUnit ?? "");
  const [currency, setCurrency] = useState(restored?.currency ?? user?.preferences?.currency ?? "EUR");
  const [paidVacation, setPaidVacation] = useState(restored?.paidVacation ?? true);
  const [paidSickLeave, setPaidSickLeave] = useState(restored?.paidSickLeave ?? true);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
  const paidMinutes = user?.preferences?.preferredDailyMinutes ?? 480;

  useEffect(() => {
    if (!userId) return;
    const draft: InitialSetupDraft = { version: 1, step, firstName, lastName, compensationType, hourlyRate, unitLabel, ratePerUnit, currency, paidVacation, paidSickLeave };
    storeInitialSetupDraft(userId, draft);
  }, [compensationType, currency, firstName, hourlyRate, lastName, paidSickLeave, paidVacation, ratePerUnit, step, unitLabel, userId]);

  const finishMutation = useMutation({
    mutationFn: async () => {
      const preferences = user?.preferences;
      if (!preferences) throw new Error(t("setup.errors.preferences"));
      return completeInitialSetup({
        firstName: firstName.trim(), lastName: lastName.trim(),
        language: i18n.resolvedLanguage ?? i18n.language ?? "en",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || preferences.timezone || "UTC",
        currency, firstDayOfWeek: preferences.firstDayOfWeek, dateFormat: preferences.dateFormat,
        timeFormat: preferences.timeFormat, theme: theme === "dark" ? "DARK" : "LIGHT",
        defaultBreakMinutes: preferences.defaultBreakMinutes,
        preferredDailyMinutes: paidMinutes,
        paidSickLeave, sickLeavePaidMinutesPerDay: paidSickLeave ? paidMinutes : 0,
        paidVacation, vacationPaidMinutesPerDay: paidVacation ? paidMinutes : 0,
        employmentName: t("setup.workplace.defaultName"), startDate: firstDayOfCurrentMonthLocalIsoDate(),
        compensationType,
        hourlyRate: compensationType === "HOURLY" ? parseNumber(hourlyRate) : null,
        fixedSalaryAmount: null, timerEnabled: false, hourBalanceEnabled: false,
        targetMinutes: null, hourBalanceValidityMonths: null,
        workTypeName: compensationType === "PER_UNIT" ? t("setup.flow.preview.completedWork") : compensationType === "FIXED_AMOUNT" ? t("setup.flow.preview.fixedWork") : t("setup.timeEntry.preview.regularShift"),
        unitLabel: compensationType === "PER_UNIT" ? unitLabel.trim() : null,
        unitSymbol: compensationType === "PER_UNIT" ? unitLabel.trim().slice(0, 20) : null,
        ratePerUnit: compensationType === "PER_UNIT" ? parseNumber(ratePerUnit) : null
      });
    },
    onSuccess: async () => {
      clearInitialSetupDraft(userId);
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

  const validate = () => {
    if (step === 1 && (!firstName.trim() || !lastName.trim())) return t("setup.errors.name");
    if (step === 2 && compensationType === "HOURLY" && !(parseNumber(hourlyRate) > 0)) return t("setup.errors.rate");
    if (step === 2 && compensationType === "PER_UNIT" && (!unitLabel.trim() || !(parseNumber(ratePerUnit) > 0))) return t("setup.errors.perUnit");
    return null;
  };
  const next = () => {
    if (finishMutation.isPending) return;
    const error = validate(); setValidationError(error);
    if (error) return;
    if (step === 3) finishMutation.mutate(); else setStep((step + 1) as 2 | 3);
  };
  const summaryWork = compensationType === "HOURLY" ? t("setup.flow.hourly") : compensationType === "PER_UNIT" ? t("setup.flow.perUnit") : t("setup.flow.fixedPrice");
  const summaryRate = compensationType === "HOURLY" ? `${currency} ${hourlyRate || "—"} / ${t("setup.flow.hour")}` : compensationType === "PER_UNIT" ? `${currency} ${ratePerUnit || "—"} / ${unitLabel}` : null;
  const awaySummary = !paidVacation && !paidSickLeave ? t("setup.flow.none") : [paidVacation ? t("setup.flow.vacation") : null, paidSickLeave ? t("setup.flow.sick") : null].filter(Boolean).join(" · ");

  return <main className="onboarding-prototype initial-setup" data-prototype-theme={theme}>
    <header className="onboarding-prototype__header"><AppLogo wordmark/><div className="onboarding-prototype__tools">
      <label className="onboarding-prototype__language"><Languages/><span>{normalizeLanguage(appI18n.resolvedLanguage).toUpperCase()}</span><select aria-label={t("setup.flow.language")} value={normalizeLanguage(appI18n.resolvedLanguage)} onChange={(event)=>{const value=normalizeLanguage(event.target.value);storeLanguagePreference(value);applyAppLanguage(value);}}>{SUPPORTED_LANGUAGES.map((language)=><option key={language} value={language}>{getNativeLanguageName(language)}</option>)}</select></label>
      <button type="button" className="onboarding-prototype__theme" aria-label={t("setup.flow.theme")} onClick={()=>{const next=theme==="dark"?"light":"dark";setTheme(next);applyAppTheme(next==="dark"?"DARK":"LIGHT");}}>{theme==="dark"?<Sun/>:<Moon/>}</button>
    </div></header>
    <section className="onboarding-prototype__flow"><div className="onboarding-prototype__form">
      <div className="onboarding-prototype__progress" aria-label={t("setup.flow.step",{step})}><span>0{step} / 03 · {t(`setup.flow.steps.${step}`)}</span><i><b style={{width:`${step*33.333}%`}}/></i></div>
      {restored ? <p className="onboarding-prototype__notice"><Check/>{t("setup.flow.restored")}</p>:null}
      <div className="onboarding-prototype__step">
      {step===1?<><FlowHeader title={t("setup.flow.nameTitle")} description={t("setup.flow.nameDescription")}/><div className="onboarding-prototype__fields two"><label>{t("setup.profile.firstName")}<input autoComplete="given-name" value={firstName} aria-invalid={Boolean(validationError)} onChange={e=>setFirstName(e.target.value)}/></label><label>{t("setup.profile.lastName")}<input autoComplete="family-name" value={lastName} aria-invalid={Boolean(validationError)} onChange={e=>setLastName(e.target.value)}/></label></div></>:null}
      {step===2?<><FlowHeader title={t("setup.flow.workTitle")} description={t("setup.flow.workDescription")}/><div className="onboarding-prototype__choices" role="radiogroup" aria-label={t("setup.flow.workTitle")}>{(["HOURLY","PER_UNIT","FIXED_AMOUNT"] as const).map(type=><button type="button" role="radio" aria-checked={compensationType===type} key={type} onClick={()=>{setCompensationType(type);setValidationError(null);}}><span>{type==="HOURLY"?t("setup.flow.hourly"):type==="PER_UNIT"?t("setup.flow.perUnit"):t("setup.flow.fixedPrice")}</span><i>{compensationType===type?<Check/>:null}</i></button>)}</div>{compensationType!=="FIXED_AMOUNT"?<div className={`onboarding-prototype__fields ${compensationType==="PER_UNIT"?"three":"rate"}`}>{compensationType==="PER_UNIT"?<label>{t("setup.flow.unit")}<input value={unitLabel} onChange={e=>setUnitLabel(e.target.value)}/></label>:null}<label>{compensationType==="PER_UNIT"?t("setup.flow.ratePerUnit"):t("setup.payment.rate")}<input inputMode="decimal" value={compensationType==="PER_UNIT"?ratePerUnit:hourlyRate} onChange={e=>compensationType==="PER_UNIT"?setRatePerUnit(e.target.value):setHourlyRate(e.target.value)}/></label><label>{t("setup.payment.currency")}<select value={currency} onChange={e=>setCurrency(e.target.value)}>{CURRENCY_OPTIONS.map(option=><option key={option}>{option}</option>)}</select></label><small>{t("setup.flow.changeRate")}</small></div>:<p className="onboarding-prototype__quiet">{t("setup.flow.fixedHelp")}</p>}</>:null}
      {step===3?<><FlowHeader title={t("setup.flow.awayTitle")} description={t("setup.flow.awayDescription")}/><div className="onboarding-prototype__away" aria-label={t("setup.flow.awayTitle")}><AwayChoice label={t("setup.flow.vacation")} selected={paidVacation} onClick={()=>setPaidVacation(!paidVacation)}/><AwayChoice label={t("setup.flow.sick")} selected={paidSickLeave} onClick={()=>setPaidSickLeave(!paidSickLeave)}/><AwayChoice label={t("setup.flow.none")} selected={!paidVacation&&!paidSickLeave} onClick={()=>{setPaidVacation(false);setPaidSickLeave(false);}}/></div><section className="onboarding-prototype__summary"><p>{t("setup.flow.firstRecord")}</p><dl><div><dt>{t("setup.flow.work")}</dt><dd>{summaryWork}</dd></div>{summaryRate?<div><dt>{t("setup.flow.rate")}</dt><dd>{summaryRate}</dd></div>:null}<div><dt>{t("setup.flow.paidAway")}</dt><dd>{awaySummary}</dd></div></dl></section><p className="onboarding-prototype__quiet">{t("setup.flow.later")}</p></>:null}
      {validationError?<p className="onboarding-prototype__error" role="alert">{validationError}</p>:null}
      {finishMutation.error?<p className="onboarding-prototype__api-error" role="alert">{t("setup.flow.apiError")}</p>:null}
      </div>
      <div className="onboarding-prototype__actions">{step>1?<button type="button" className="back" onClick={()=>{setValidationError(null);setStep((step-1) as 1|2);}}><ChevronLeft/>{t("setup.actions.back")}</button>:<span/>}<button type="button" className="continue" aria-busy={finishMutation.isPending} disabled={finishMutation.isPending} onClick={next}>{finishMutation.isPending?<><LoaderCircle className="spin"/>{t("setup.flow.creating")}</>:step===3?t("setup.flow.create"):t("setup.actions.continue")}</button></div>
    </div><aside className="onboarding-prototype__preview" aria-label={t("setup.flow.previewLabel")}><div className="onboarding-prototype__preview-grid"/><p>{t("setup.flow.firstRecord")}</p><h2>{step===1?t("setup.flow.preview.named"):t("setup.flow.preview.workday")}</h2><div className="onboarding-prototype__day"><div><span>{t("setup.timeEntry.preview.regularShift")}</span><b>{step===1?t("setup.flow.preview.day"):summaryWork}</b></div><time>08:00 → 16:30</time><dl><div><dt>{t("setup.flow.work")}</dt><dd>{step===1?"—":summaryWork}</dd></div><div><dt>{t("setup.flow.rate")}</dt><dd>{step===1?"—":summaryRate??t("setup.flow.preview.perRecord")}</dd></div><div><dt>{t("setup.flow.paidAway")}</dt><dd>{step<3?t("setup.flow.preview.step3"):awaySummary}</dd></div></dl></div></aside></section>
  </main>;
}

function FlowHeader({title,description}:{title:string;description:string}){return <div className="onboarding-prototype__intro"><h1>{title}</h1><p>{description}</p></div>;}
function AwayChoice({label,selected,onClick}:{label:string;selected:boolean;onClick:()=>void}){return <button type="button" aria-pressed={selected} onClick={onClick}><i>{selected?<Check/>:null}</i>{label}</button>;}
function parseNumber(value:string){return Number(value.replace(",","."));}

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

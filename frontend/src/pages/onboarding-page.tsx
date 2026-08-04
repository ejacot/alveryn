import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  completeOnboarding,
  createHourlyRate,
  getOnboardingStatus,
  listEmployments,
  listHourlyRates,
  updatePreferences,
  updateProfile
} from "../api/endpoints";
import { getApiError } from "../api/api-errors";
import { queryKeys } from "../api/query-keys";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { ScreenMessage } from "../components/ui/screen-message";
import { Card } from "../components/ui/card";
import { AppLogo } from "../components/branding/app-logo";
import {
  clearStoredOnboardingStep,
  storeOnboardingStep
} from "../features/onboarding/onboarding-storage";
import {
  hourlyRateStepSchema,
  profileStepSchema
} from "../features/onboarding/onboarding-schemas";
import { useAuth } from "../features/auth/use-auth";
import { APP_HOME_PATH } from "../routes/app-paths";
import { firstDayOfCurrentMonthLocalIsoDate } from "../utils/date";

const STEP_PROFILE = 1;
const STEP_HOURLY_RATE = 2;
const DEFAULT_DATE_FORMAT = "dd/MM/yyyy";
const CURRENCY_OPTIONS = ["EUR", "CHF", "RON", "USD", "GBP", "PLN"];

export function OnboardingPage() {
  const { t } = useTranslation("onboarding");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, refreshCurrentUser } = useAuth();
  const [currentStep, setCurrentStep] = useState(STEP_PROFILE);
  const [defaultsReady, setDefaultsReady] = useState(false);
  const userId = user?.account.id ?? null;

  const onboardingStatusQuery = useQuery({
    queryKey: queryKeys.onboardingStatus(),
    queryFn: getOnboardingStatus,
    enabled: Boolean(userId)
  });
  const hourlyRatesQuery = useQuery({
    queryKey: queryKeys.hourlyRates.all(),
    queryFn: listHourlyRates,
    enabled: Boolean(userId && defaultsReady)
  });
  const employmentsQuery = useQuery({
    queryKey: queryKeys.employments.all(),
    queryFn: listEmployments,
    enabled: Boolean(userId && defaultsReady)
  });

  const earningsEmployment = employmentsQuery.data?.find(
    (employment) => employment.active && employment.trackingFocus === "EARNINGS"
  );
  const hourlyRateRequired = Boolean(earningsEmployment);

  const profileComplete = Boolean(
    user?.profile?.firstName?.trim() && user.profile?.lastName?.trim()
  );
  const hourlyRateComplete =
    !hourlyRateRequired ||
    Boolean(
      hourlyRatesQuery.data?.some(
        (rate) => rate.employmentId === earningsEmployment?.id
      )
    );

  const profileForm = useForm({
    resolver: zodResolver(profileStepSchema),
    defaultValues: {
      firstName: "",
      lastName: ""
    }
  });
  const hourlyRateForm = useForm({
    resolver: zodResolver(hourlyRateStepSchema),
    defaultValues: {
      hourlyRate: "",
      currency: "EUR",
      validFrom: ""
    }
  });
  useEffect(() => {
    setDefaultsReady(false);
  }, [userId]);

  useEffect(() => {
    profileForm.reset({
      firstName: user?.profile?.firstName ?? "",
      lastName: user?.profile?.lastName ?? ""
    });
  }, [profileForm, user?.profile?.firstName, user?.profile?.lastName]);

  const automaticPreferences = useMemo(
    () => ({
      language:
        typeof navigator === "undefined"
          ? "en"
          : navigator.language.split("-")[0]?.slice(0, 10)?.toLowerCase() || "en",
      timezone:
        typeof Intl !== "undefined"
          ? Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
          : "UTC",
      currency: "EUR",
      firstDayOfWeek: "MONDAY" as const,
      dateFormat: DEFAULT_DATE_FORMAT,
      timeFormat: "H24" as const,
      theme: "SYSTEM" as const,
      defaultBreakMinutes: 30,
      preferredDailyMinutes: 480,
      paidSickLeave: true,
      paidVacation: true
    }),
    []
  );

  const preferencesBootstrapMutation = useMutation({
    mutationFn: updatePreferences,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.onboardingStatus() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.preferences() }),
        refreshCurrentUser()
      ]);
      setDefaultsReady(true);
    }
  });

  useEffect(() => {
    if (!userId || defaultsReady || preferencesBootstrapMutation.isPending) {
      return;
    }

    void preferencesBootstrapMutation.mutateAsync(automaticPreferences);
  }, [
    automaticPreferences,
    defaultsReady,
    preferencesBootstrapMutation,
    userId
  ]);

  useEffect(() => {
    if (!userId || !defaultsReady) {
      return;
    }

    if (onboardingStatusQuery.data?.onboardingCompleted) {
      clearStoredOnboardingStep(userId);
      void refreshCurrentUser().then(() => navigate(APP_HOME_PATH, { replace: true }));
      return;
    }

    setCurrentStep(
      deriveCurrentStep({
        profileComplete,
        hourlyRateComplete,
        hourlyRateRequired
      })
    );
  }, [
    defaultsReady,
    hourlyRateComplete,
    hourlyRateRequired,
    navigate,
    onboardingStatusQuery.data?.onboardingCompleted,
    profileComplete,
    refreshCurrentUser,
    userId
  ]);

  useEffect(() => {
    if (userId) {
      storeOnboardingStep(userId, currentStep);
    }
  }, [currentStep, userId]);

  const profileMutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: async () => {
      await refreshCurrentUser();
      if (hourlyRateRequired) {
        setCurrentStep(STEP_HOURLY_RATE);
      } else {
        await finishMutation.mutateAsync();
      }
    }
  });

  const finishMutation = useMutation({
    mutationFn: completeOnboarding,
    onSuccess: async () => {
      if (userId) {
        clearStoredOnboardingStep(userId);
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.onboardingStatus() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.hourlyRates.all() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.workTypes.all() }),
        refreshCurrentUser()
      ]);
      navigate(APP_HOME_PATH, { replace: true });
    }
  });

  useEffect(() => {
    if (
      defaultsReady &&
      employmentsQuery.isSuccess &&
      profileComplete &&
      !hourlyRateRequired &&
      !onboardingStatusQuery.data?.onboardingCompleted &&
      !finishMutation.isPending
    ) {
      void finishMutation.mutateAsync();
    }
  }, [
    defaultsReady,
    employmentsQuery.isSuccess,
    finishMutation,
    hourlyRateRequired,
    onboardingStatusQuery.data?.onboardingCompleted,
    profileComplete
  ]);

  const hourlyRateMutation = useMutation({
    mutationFn: createHourlyRate
  });
  const currencyPreferenceMutation = useMutation({
    mutationFn: updatePreferences
  });

  const isBootstrapping =
    !userId ||
    !defaultsReady ||
    onboardingStatusQuery.isLoading ||
    hourlyRatesQuery.isLoading ||
    employmentsQuery.isLoading ||
    preferencesBootstrapMutation.isPending;

  const combinedError =
    onboardingStatusQuery.error ??
    hourlyRatesQuery.error ??
    employmentsQuery.error ??
    preferencesBootstrapMutation.error;

  if (!userId || isBootstrapping) {
    return (
      <ScreenMessage
        title={t("loadingTitle")}
        description={t("loadingDescription")}
      />
    );
  }

  if (combinedError) {
    return (
      <Card variant="section" className="mt-10 space-y-4 text-center">
        <p className="text-lg font-semibold text-white">{t("errorTitle")}</p>
        <p className="text-sm leading-6 text-white/62">{getApiError(combinedError).message}</p>
        <Button
          className="w-full"
          onClick={() => {
            setDefaultsReady(false);
            void Promise.all([onboardingStatusQuery.refetch(), hourlyRatesQuery.refetch()]);
          }}
        >
          {t("retry")}
        </Button>
      </Card>
    );
  }

  const totalSteps = hourlyRateRequired ? 2 : 1;
  const progressValue = (currentStep / totalSteps) * 100;

  return (
    <section className="dashboard-glass-preview relative min-h-[calc(100dvh-2rem)] overflow-hidden pb-10 pt-5">
      <div className="pointer-events-none absolute left-1/2 top-[-9rem] h-[24rem] w-[24rem] -translate-x-1/2 rounded-full bg-[#10b981]/[0.055] blur-[90px]" />
      <div className="relative mx-auto max-w-md">
        <div className="mb-10 flex items-center justify-between px-1">
          <AppLogo wordmark />
          <span className="font-metric text-xs font-semibold tabular-nums text-white/35">
            {currentStep} / {totalSteps}
          </span>
        </div>
        <div className="mb-7 grid gap-2" style={{ gridTemplateColumns: `repeat(${totalSteps}, minmax(0, 1fr))` }}>
          {Array.from({ length: totalSteps }, (_, index) => (
            <span key={index} className={`h-[3px] rounded-full transition-colors duration-300 ${index < currentStep ? "bg-[#10b981]" : "bg-white/[0.09]"}`} />
          ))}
          <motion.div
            className="sr-only"
            animate={{ width: `${progressValue}%` }}
          />
        </div>

      <Card
        as={motion.div}
        key={currentStep}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        variant="section"
        className="space-y-6 rounded-[30px] border-white/[0.085] bg-white/[0.035] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.32)] backdrop-blur-2xl sm:p-6"
      >
        {currentStep === STEP_PROFILE ? (
          <form
            className="space-y-5"
            onSubmit={profileForm.handleSubmit(async (values) => {
              await profileMutation.mutateAsync({
                firstName: values.firstName,
                lastName: values.lastName,
                phone: user?.profile?.phone ?? null,
                employmentStartDate: user?.profile?.employmentStartDate ?? null,
                displayName: user?.profile?.displayName ?? null,
                dateOfBirth: user?.profile?.dateOfBirth ?? null,
                countryCode: user?.profile?.countryCode ?? null,
                city: user?.profile?.city ?? null,
                postalCode: user?.profile?.postalCode ?? null,
                street: user?.profile?.street ?? null,
                houseNumber: user?.profile?.houseNumber ?? null,
                apartment: user?.profile?.apartment ?? null,
                avatarUrl: user?.profile?.avatarUrl ?? null,
                employmentEndDate: user?.profile?.employmentEndDate ?? null
              });
            })}
          >
            <StepHeader
              eyebrow={t("setup.label")}
              title={t("setup.profile.title")}
              description={t("setup.profile.description")}
            />
            <Input
              label={t("setup.profile.firstName")}
              error={profileForm.formState.errors.firstName?.message}
              {...profileForm.register("firstName")}
            />
            <Input
              label={t("setup.profile.lastName")}
              error={profileForm.formState.errors.lastName?.message}
              {...profileForm.register("lastName")}
            />
            <Button className="w-full" type="submit" disabled={profileMutation.isPending}>
              {profileMutation.isPending ? t("setup.actions.saving") : t("setup.actions.continue")}
            </Button>
            <FormLevelError error={profileMutation.error} />
          </form>
        ) : null}

        {currentStep === STEP_HOURLY_RATE ? (
          <form
            className="space-y-5"
            onSubmit={hourlyRateForm.handleSubmit(async (values) => {
              await hourlyRateMutation.mutateAsync({
                employmentId: earningsEmployment?.id,
                hourlyRate: values.hourlyRate,
                currency: values.currency,
                validFrom: resolveHourlyRateValidFrom(values.validFrom)
              });
              if (values.currency !== user?.preferences?.currency) {
                await currencyPreferenceMutation.mutateAsync({
                  language: user?.preferences?.language ?? automaticPreferences.language,
                  timezone: user?.preferences?.timezone ?? automaticPreferences.timezone,
                  currency: values.currency,
                  firstDayOfWeek: user?.preferences?.firstDayOfWeek ?? automaticPreferences.firstDayOfWeek,
                  dateFormat: user?.preferences?.dateFormat ?? automaticPreferences.dateFormat,
                  timeFormat: user?.preferences?.timeFormat ?? automaticPreferences.timeFormat,
                  theme: user?.preferences?.theme ?? automaticPreferences.theme,
                  defaultBreakMinutes: user?.preferences?.defaultBreakMinutes ?? automaticPreferences.defaultBreakMinutes,
                  preferredDailyMinutes: user?.preferences?.preferredDailyMinutes ?? automaticPreferences.preferredDailyMinutes,
                  paidSickLeave: user?.preferences?.paidSickLeave ?? automaticPreferences.paidSickLeave,
                  paidVacation: user?.preferences?.paidVacation ?? automaticPreferences.paidVacation
                });
              }
              await finishMutation.mutateAsync();
            })}
          >
            <StepHeader
              eyebrow={t("setup.label")}
              title={t("hourlyRateTitle")}
              description={t("hourlyRateDescription")}
            />
            <div className="grid grid-cols-[1fr_7rem] gap-3">
              <Input
                label={t("setup.payment.rate")}
                type="text"
                inputMode="decimal"
                pattern="[0-9]*[.,]?[0-9]*"
                placeholder="17.50"
                error={hourlyRateForm.formState.errors.hourlyRate?.message}
                {...hourlyRateForm.register("hourlyRate", {
                  setValueAs: (value) => (typeof value === "string" ? value.replace(",", ".") : value)
                })}
                onInput={(event) => {
                  event.currentTarget.value = event.currentTarget.value.replace(",", ".");
                }}
              />
              <Select
                label={t("setup.payment.currency")}
                error={hourlyRateForm.formState.errors.currency?.message}
                {...hourlyRateForm.register("currency")}
              >
                {CURRENCY_OPTIONS.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </Select>
            </div>
            <Input
              label={t("hourlyRateStartDate")}
              type="date"
              error={hourlyRateForm.formState.errors.validFrom?.message}
              {...hourlyRateForm.register("validFrom")}
            />
            <p className="-mt-3 text-xs leading-5 text-white/42">
              {t("hourlyRateStartDateHint")}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Button
                className="w-full"
                variant="ghost"
                onClick={() => setCurrentStep(STEP_PROFILE)}
              >
                {t("setup.actions.back")}
              </Button>
              <Button
                className="w-full"
                type="submit"
                disabled={
                  hourlyRateMutation.isPending ||
                  currencyPreferenceMutation.isPending ||
                  finishMutation.isPending
                }
              >
                {hourlyRateMutation.isPending ||
                currencyPreferenceMutation.isPending ||
                finishMutation.isPending
                  ? t("setup.actions.saving")
                  : t("setup.actions.finish")}
              </Button>
            </div>
            <FormLevelError error={hourlyRateMutation.error ?? currencyPreferenceMutation.error ?? finishMutation.error} />
          </form>
        ) : null}
      </Card>
      </div>
    </section>
  );
}

function StepHeader({
  eyebrow,
  title,
  description
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="space-y-2.5">
      {eyebrow ? <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-[#10b981]/65">{eyebrow}</p> : null}
      <h1 className="text-[2rem] font-semibold leading-[1.04] tracking-[-0.055em] text-[#f5f5f5]">{title}</h1>
      {description ? (
        <p className="text-sm leading-6 text-white/62">{description}</p>
      ) : null}
    </div>
  );
}

function FormLevelError({ error }: { error: unknown }) {
  if (!error) {
    return null;
  }

  return <p className="text-sm text-red-300">{getApiError(error).message}</p>;
}

export function deriveCurrentStep({
  profileComplete,
  hourlyRateComplete,
  hourlyRateRequired = true
}: {
  profileComplete: boolean;
  hourlyRateComplete: boolean;
  hourlyRateRequired?: boolean;
}) {
  if (!profileComplete) {
    return STEP_PROFILE;
  }
  if (hourlyRateRequired && !hourlyRateComplete) {
    return STEP_HOURLY_RATE;
  }
  return STEP_HOURLY_RATE;
}

export function resolveHourlyRateValidFrom(value?: string, fallbackDate = new Date()) {
  const trimmed = value?.trim();
  return trimmed || firstDayOfCurrentMonthLocalIsoDate(fallbackDate);
}

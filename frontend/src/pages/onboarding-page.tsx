import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import {
  completeOnboarding,
  createHourlyRate,
  getOnboardingStatus,
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
import {
  clearStoredOnboardingStep,
  getStoredOnboardingStep,
  storeOnboardingStep
} from "../features/onboarding/onboarding-storage";
import {
  hourlyRateStepSchema,
  profileStepSchema
} from "../features/onboarding/onboarding-schemas";
import { useAuth } from "../features/auth/use-auth";
import { todayLocalIsoDate } from "../utils/date";

const STEP_PROFILE = 1;
const STEP_HOURLY_RATE = 2;
const TOTAL_STEPS = 2;
const DEFAULT_DATE_FORMAT = "dd/MM/yyyy";
const CURRENCY_OPTIONS = ["EUR", "CHF", "RON", "USD", "GBP", "PLN"];

export function OnboardingPage() {
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

  const profileComplete = Boolean(
    user?.profile?.firstName?.trim() && user.profile?.lastName?.trim()
  );
  const hourlyRateComplete = Boolean(hourlyRatesQuery.data?.length);

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
      currency: "EUR"
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
      void refreshCurrentUser().then(() => navigate("/", { replace: true }));
      return;
    }

    const storedStep = getStoredOnboardingStep(userId);
    setCurrentStep(
      deriveCurrentStep({
        storedStep,
        profileComplete,
        hourlyRateComplete
      })
    );
  }, [
    defaultsReady,
    hourlyRateComplete,
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
      setCurrentStep(STEP_HOURLY_RATE);
      await refreshCurrentUser();
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
      navigate("/", { replace: true });
    }
  });

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
    preferencesBootstrapMutation.isPending;

  const combinedError =
    onboardingStatusQuery.error ??
    hourlyRatesQuery.error ??
    preferencesBootstrapMutation.error;

  if (!userId || isBootstrapping) {
    return (
      <ScreenMessage
        title="Preparing Alveryn..."
        description="Applying your defaults and restoring the shortest path into the app."
      />
    );
  }

  if (combinedError) {
    return (
      <div className="section-card mt-10 space-y-4 text-center">
        <p className="text-lg font-semibold text-white">Onboarding needs another try</p>
        <p className="text-sm leading-6 text-white/62">{getApiError(combinedError).message}</p>
        <Button
          className="w-full"
          onClick={() => {
            setDefaultsReady(false);
            void Promise.all([onboardingStatusQuery.refetch(), hourlyRatesQuery.refetch()]);
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  const progressValue = ((currentStep - 1) / (TOTAL_STEPS - 1)) * 100;

  return (
    <section className="pb-8 pt-6">
      <div className="mx-auto mb-8 max-w-md space-y-4">
        <div className="flex items-center justify-between text-xs font-medium uppercase tracking-[0.24em] text-white/42">
          <span>Onboarding</span>
          <span>
            {currentStep} / {TOTAL_STEPS}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-white/10">
          <motion.div
            className="h-full rounded-full bg-white"
            animate={{ width: `${progressValue}%` }}
            transition={{ duration: 0.24, ease: "easeOut" }}
          />
        </div>
      </div>

      <motion.div
        key={currentStep}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, ease: "easeOut" }}
        className="section-card mx-auto max-w-md space-y-6 rounded-[32px] p-6"
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
              title="Let's get to know you"
            />
            <Input
              label="First name"
              error={profileForm.formState.errors.firstName?.message}
              {...profileForm.register("firstName")}
            />
            <Input
              label="Last name"
              error={profileForm.formState.errors.lastName?.message}
              {...profileForm.register("lastName")}
            />
            <Button className="w-full" type="submit" disabled={profileMutation.isPending}>
              {profileMutation.isPending ? "Saving..." : "Continue"}
            </Button>
            <FormLevelError error={profileMutation.error} />
          </form>
        ) : null}

        {currentStep === STEP_HOURLY_RATE ? (
          <form
            className="space-y-5"
            onSubmit={hourlyRateForm.handleSubmit(async (values) => {
              await hourlyRateMutation.mutateAsync({
                hourlyRate: values.hourlyRate,
                currency: values.currency,
                validFrom: todayLocalIsoDate()
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
              title="What is your hourly rate?"
            />
            <div className="grid grid-cols-[1fr_7rem] gap-3">
              <Input
                label="Amount per hour"
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
                label="Currency"
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
            <div className="grid grid-cols-2 gap-3">
              <Button
                className="w-full"
                variant="ghost"
                onClick={() => setCurrentStep(STEP_PROFILE)}
              >
                Back
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
                  ? "Finishing..."
                  : "Let's go"}
              </Button>
            </div>
            <FormLevelError error={hourlyRateMutation.error ?? currencyPreferenceMutation.error ?? finishMutation.error} />
          </form>
        ) : null}
      </motion.div>
    </section>
  );
}

function StepHeader({
  title,
  description
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="space-y-2">
      <h1 className="text-[1.9rem] font-semibold leading-tight text-white">{title}</h1>
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
  storedStep,
  profileComplete,
  hourlyRateComplete
}: {
  storedStep: number | null;
  profileComplete: boolean;
  hourlyRateComplete: boolean;
}) {
  if (!profileComplete) {
    return STEP_PROFILE;
  }
  if (!hourlyRateComplete) {
    return STEP_HOURLY_RATE;
  }
  return STEP_HOURLY_RATE;
}

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";
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
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { ScreenMessage } from "../components/ui/screen-message";
import { Select } from "../components/ui/select";
import {
  clearStoredOnboardingStep,
  getStoredOnboardingStep,
  storeOnboardingStep
} from "../features/onboarding/onboarding-storage";
import {
  hourlyRateStepSchema,
  preferencesStepSchema,
  profileStepSchema
} from "../features/onboarding/onboarding-schemas";
import { useAuth } from "../features/auth/use-auth";

const STEP_WELCOME = 1;
const STEP_PROFILE = 2;
const STEP_PREFERENCES = 3;
const STEP_HOURLY_RATE = 4;
const STEP_FINISH = 5;

const DEFAULT_DATE_FORMAT = "dd/MM/yyyy";
const ONBOARDING_STEPS = STEP_FINISH;

export function OnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, refreshCurrentUser } = useAuth();
  const [currentStep, setCurrentStep] = useState(STEP_WELCOME);
  const userId = user?.account.id ?? null;

  const onboardingStatusQuery = useQuery({
    queryKey: ["onboarding-status"],
    queryFn: getOnboardingStatus,
    enabled: Boolean(userId)
  });
  const hourlyRatesQuery = useQuery({
    queryKey: ["hourly-rates"],
    queryFn: listHourlyRates,
    enabled: Boolean(userId)
  });

  const isLoading = onboardingStatusQuery.isLoading || hourlyRatesQuery.isLoading;
  const combinedError = onboardingStatusQuery.error ?? hourlyRatesQuery.error;

  const profileComplete = Boolean(
    user?.profile?.firstName?.trim() && user.profile?.lastName?.trim()
  );
  const preferencesComplete = Boolean(user?.preferences);
  const hourlyRateComplete = Boolean(hourlyRatesQuery.data?.length);

  const profileForm = useForm({
    resolver: zodResolver(profileStepSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      phone: "",
      employmentStartDate: ""
    }
  });
  const preferencesForm = useForm({
    resolver: zodResolver(preferencesStepSchema),
    defaultValues: {
      language: "",
      currency: "EUR",
      timezone: "",
      defaultBreakMinutes: 30,
      preferredDailyHours: 8
    }
  });
  const hourlyRateForm = useForm({
    resolver: zodResolver(hourlyRateStepSchema),
    defaultValues: {
      hourlyRate: 0,
      currency: "EUR"
    }
  });

  useEffect(() => {
    if (user?.profile) {
      profileForm.reset({
        firstName: user.profile.firstName ?? "",
        lastName: user.profile.lastName ?? "",
        phone: user.profile.phone ?? "",
        employmentStartDate: user.profile.employmentStartDate ?? ""
      });
    }
  }, [profileForm, user?.profile]);

  useEffect(() => {
    if (user?.preferences) {
      preferencesForm.reset({
        language: user.preferences.language,
        currency: user.preferences.currency,
        timezone: user.preferences.timezone,
        defaultBreakMinutes: user.preferences.defaultBreakMinutes,
        preferredDailyHours: (user.preferences.preferredDailyMinutes ?? 480) / 60
      });
      hourlyRateForm.setValue("currency", user.preferences.currency);
      return;
    }

    const browserLanguage =
      typeof navigator === "undefined"
        ? "en"
        : navigator.language.split("-")[0]?.slice(0, 10) || "en";
    const browserTimezone =
      typeof Intl !== "undefined"
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : "Europe/Berlin";

    preferencesForm.reset({
      language: browserLanguage,
      currency: "EUR",
      timezone: browserTimezone,
      defaultBreakMinutes: 30,
      preferredDailyHours: 8
    });
    hourlyRateForm.setValue("currency", "EUR");
  }, [hourlyRateForm, preferencesForm, user?.preferences]);

  useEffect(() => {
    if (!userId || isLoading) {
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
        preferencesComplete,
        hourlyRateComplete
      })
    );
  }, [
    hourlyRateComplete,
    isLoading,
    navigate,
    onboardingStatusQuery.data?.onboardingCompleted,
    preferencesComplete,
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
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["onboarding-status"] }),
        refreshCurrentUser()
      ]);
      setCurrentStep(STEP_PREFERENCES);
    }
  });

  const preferencesMutation = useMutation({
    mutationFn: updatePreferences,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["onboarding-status"] }),
        refreshCurrentUser()
      ]);
      setCurrentStep(STEP_HOURLY_RATE);
    }
  });

  const hourlyRateMutation = useMutation({
    mutationFn: createHourlyRate,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["hourly-rates"] }),
        queryClient.invalidateQueries({ queryKey: ["onboarding-status"] })
      ]);
      setCurrentStep(STEP_FINISH);
    }
  });

  const finishMutation = useMutation({
    mutationFn: completeOnboarding,
    onSuccess: async () => {
      if (userId) {
        clearStoredOnboardingStep(userId);
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["onboarding-status"] }),
        queryClient.invalidateQueries({ queryKey: ["hourly-rates"] }),
        queryClient.invalidateQueries({ queryKey: ["work-types"] }),
        refreshCurrentUser()
      ]);
      navigate("/", { replace: true });
    }
  });

  function goBack() {
    if (currentStep <= STEP_WELCOME) {
      return;
    }

    setCurrentStep((step) => Math.max(STEP_WELCOME, step - 1));
  }

  if (!userId) {
    return <ScreenMessage title="Loading session..." />;
  }

  if (isLoading) {
    return (
      <ScreenMessage
        title="Preparing onboarding..."
        description="Restoring your setup and the next step."
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
            void Promise.all([onboardingStatusQuery.refetch(), hourlyRatesQuery.refetch()]);
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  const progressValue =
    ((Math.min(currentStep, ONBOARDING_STEPS) - 1) / Math.max(ONBOARDING_STEPS - 1, 1)) * 100;

  return (
    <section className="pb-8 pt-6">
      <div className="mx-auto mb-8 max-w-md space-y-4">
        <div className="flex items-center justify-between text-xs font-medium uppercase tracking-[0.24em] text-white/42">
          <span>Onboarding</span>
          <span>
            {Math.min(currentStep, ONBOARDING_STEPS)} / {ONBOARDING_STEPS}
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
        {currentStep === STEP_WELCOME ? (
          <StepScaffold
            title="Let's get everything ready in less than 30 seconds."
            description="Only the essentials now. Roomly will take care of the rest in the background."
            primaryAction={
              <Button className="w-full" onClick={() => setCurrentStep(STEP_PROFILE)}>
                Continue
              </Button>
            }
          />
        ) : null}

        {currentStep === STEP_PROFILE ? (
          <form
            className="space-y-4"
            onSubmit={profileForm.handleSubmit(async (values) => {
              await profileMutation.mutateAsync({
                firstName: values.firstName,
                lastName: values.lastName,
                phone: emptyToNull(values.phone),
                employmentStartDate: emptyToNull(values.employmentStartDate),
                displayName: null,
                dateOfBirth: null,
                countryCode: null,
                city: null,
                postalCode: null,
                street: null,
                houseNumber: null,
                apartment: null,
                avatarUrl: null,
                employmentEndDate: null
              });
            })}
          >
            <StepHeader
              title="A quick profile touch."
              description="Just enough to make the app feel personal from the first day."
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
            <Input
              label="Phone (optional)"
              error={profileForm.formState.errors.phone?.message}
              {...profileForm.register("phone")}
            />
            <Input
              label="Employment start date (optional)"
              type="date"
              error={profileForm.formState.errors.employmentStartDate?.message}
              {...profileForm.register("employmentStartDate")}
            />
            <StepActions
              onBack={goBack}
              primaryLabel="Save and continue"
              isSubmitting={profileMutation.isPending}
            />
            <FormLevelError error={profileMutation.error} />
          </form>
        ) : null}

        {currentStep === STEP_PREFERENCES ? (
          <form
            className="space-y-4"
            onSubmit={preferencesForm.handleSubmit(async (values) => {
              await preferencesMutation.mutateAsync({
                language: values.language.trim().toLowerCase(),
                timezone: values.timezone.trim(),
                currency: values.currency.trim().toUpperCase(),
                firstDayOfWeek: "MONDAY",
                dateFormat: DEFAULT_DATE_FORMAT,
                timeFormat: "H24",
                theme: "DARK",
                defaultBreakMinutes: values.defaultBreakMinutes,
                preferredDailyMinutes: Math.round(values.preferredDailyHours * 60)
              });
            })}
          >
            <StepHeader
              title="Tune your default rhythm."
              description="Language, currency and timezone are enough to make Roomly yours."
            />
            <Select
              label="Language"
              error={preferencesForm.formState.errors.language?.message}
              {...preferencesForm.register("language")}
            >
              <option value="en">English</option>
              <option value="ro">Romana</option>
              <option value="de">Deutsch</option>
            </Select>
            <Select
              label="Currency"
              error={preferencesForm.formState.errors.currency?.message}
              {...preferencesForm.register("currency")}
            >
              <option value="EUR">EUR</option>
              <option value="RON">RON</option>
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
            </Select>
            <Select
              label="Timezone"
              error={preferencesForm.formState.errors.timezone?.message}
              {...preferencesForm.register("timezone")}
            >
              {TIMEZONE_OPTIONS.map((timezone) => (
                <option key={timezone} value={timezone}>
                  {timezone}
                </option>
              ))}
            </Select>
            <Input
              label="Default break (minutes)"
              type="number"
              min={0}
              error={preferencesForm.formState.errors.defaultBreakMinutes?.message}
              {...preferencesForm.register("defaultBreakMinutes")}
            />
            <Input
              label="Preferred daily hours"
              type="number"
              min={1}
              step="0.5"
              error={preferencesForm.formState.errors.preferredDailyHours?.message}
              {...preferencesForm.register("preferredDailyHours")}
            />
            <StepActions
              onBack={goBack}
              primaryLabel="Save and continue"
              isSubmitting={preferencesMutation.isPending}
            />
            <FormLevelError error={preferencesMutation.error} />
          </form>
        ) : null}

        {currentStep === STEP_HOURLY_RATE ? (
          <form
            className="space-y-4"
            onSubmit={hourlyRateForm.handleSubmit(async (values) => {
              await hourlyRateMutation.mutateAsync({
                hourlyRate: values.hourlyRate,
                currency: values.currency.trim().toUpperCase(),
                validFrom: new Date().toISOString().slice(0, 10)
              });
            })}
          >
            <StepHeader
              title="Set your hourly rate."
              description="We will start it from today automatically and keep history for settings later."
            />
            <Input
              label="Hourly rate"
              type="number"
              min={0}
              step="0.01"
              error={hourlyRateForm.formState.errors.hourlyRate?.message}
              {...hourlyRateForm.register("hourlyRate")}
            />
            <Select
              label="Currency"
              error={hourlyRateForm.formState.errors.currency?.message}
              {...hourlyRateForm.register("currency")}
            >
              <option value="EUR">EUR</option>
              <option value="RON">RON</option>
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
            </Select>
            <StepActions
              onBack={goBack}
              primaryLabel="Save and continue"
              isSubmitting={hourlyRateMutation.isPending}
            />
            <FormLevelError error={hourlyRateMutation.error} />
          </form>
        ) : null}

        {currentStep === STEP_FINISH ? (
          <div className="space-y-5">
            <StepHeader
              title="You are ready to track work."
              description="Roomly will create a default Regular Shift for you if no work type exists yet."
            />
            <div className="space-y-3 rounded-[24px] border border-white/[0.08] bg-white/[0.04] p-4">
              <SummaryRow label="Profile" complete={profileComplete} />
              <SummaryRow label="Preferences" complete={preferencesComplete} />
              <SummaryRow label="Hourly Rate" complete={hourlyRateComplete} />
              <SummaryRow label="Default Work Type" complete>
                Created automatically on finish
              </SummaryRow>
            </div>
            {onboardingStatusQuery.data?.missingSteps.length ? (
              <div className="rounded-[24px] border border-white/[0.08] bg-white/[0.04] p-4 text-sm text-white/70">
                Missing backend requirements:{" "}
                {onboardingStatusQuery.data.missingSteps.join(", ")}
              </div>
            ) : null}
            <StepActions
              onBack={goBack}
              primaryLabel="Enter Roomly"
              isSubmitting={finishMutation.isPending}
              onPrimary={() => {
                void finishMutation.mutateAsync();
              }}
            />
            <FormLevelError error={finishMutation.error} />
          </div>
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
  description: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-[0.28em] text-white/42">
        Roomly setup
      </p>
      <h1 className="text-[1.85rem] font-semibold leading-tight text-white">{title}</h1>
      <p className="text-sm leading-6 text-white/62">{description}</p>
    </div>
  );
}

function StepScaffold({
  title,
  description,
  primaryAction
}: {
  title: string;
  description: string;
  primaryAction: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <StepHeader title={title} description={description} />
      {primaryAction}
    </div>
  );
}

function StepActions({
  onBack,
  primaryLabel,
  isSubmitting,
  onPrimary
}: {
  onBack: () => void;
  primaryLabel: string;
  isSubmitting: boolean;
  onPrimary?: () => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Button className="w-full" variant="ghost" onClick={onBack}>
        Back
      </Button>
      <Button
        className="w-full"
        type={onPrimary ? "button" : "submit"}
        onClick={onPrimary}
        disabled={isSubmitting}
      >
        {isSubmitting ? "Saving..." : primaryLabel}
      </Button>
    </div>
  );
}

function SummaryRow({
  label,
  complete,
  children
}: {
  label: string;
  complete: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="space-y-1">
        <span className="text-sm text-white/72">{label}</span>
        {children ? <p className="text-xs text-white/42">{children}</p> : null}
      </div>
      <span className="text-sm font-medium text-white">{complete ? "Done" : "Missing"}</span>
    </div>
  );
}

function FormLevelError({ error }: { error: unknown }) {
  if (!error) {
    return null;
  }

  return <p className="text-sm text-red-300">{getApiError(error).message}</p>;
}

function emptyToNull(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function deriveCurrentStep({
  storedStep,
  profileComplete,
  preferencesComplete,
  hourlyRateComplete
}: {
  storedStep: number | null;
  profileComplete: boolean;
  preferencesComplete: boolean;
  hourlyRateComplete: boolean;
}) {
  if (!profileComplete) {
    return storedStep === STEP_WELCOME ? STEP_WELCOME : STEP_PROFILE;
  }
  if (!preferencesComplete) {
    return STEP_PREFERENCES;
  }
  if (!hourlyRateComplete) {
    return STEP_HOURLY_RATE;
  }
  return STEP_FINISH;
}

const TIMEZONE_OPTIONS = [
  "Europe/Berlin",
  "Europe/Bucharest",
  "Europe/London",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles"
];

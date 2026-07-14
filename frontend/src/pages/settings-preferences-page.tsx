import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { getApiError } from "../api/api-errors";
import { queryKeys } from "../api/query-keys";
import { getPreferences, updatePreferences, type UpdatePreferencesPayload } from "../api/endpoints";
import { useAuth } from "../features/auth/use-auth";
import { SettingsFormActions } from "../components/settings/settings-form-actions";
import { SettingsPageHeader } from "../components/settings/settings-page-header";
import { SettingsPageSkeleton } from "../components/settings/settings-page-skeleton";
import { SettingsSection } from "../components/settings/settings-section";
import { ScreenMessage } from "../components/ui/screen-message";
import { Select } from "../components/ui/select";
import { useSafeBackNavigation } from "../hooks/use-safe-back-navigation";
import { useUnsavedChangesGuard } from "../hooks/use-unsaved-changes-guard";
import { applyAppLanguage } from "../i18n";
import { getNativeLanguageName, normalizeLanguage } from "../i18n/language";
import { getSupportedTimezones } from "../utils/timezones";

const schema = z.object({
  language: z.string().min(2),
  currency: z.string().length(3),
  timezone: z.string().min(3),
  defaultBreakMinutes: z.coerce.number().min(0),
  preferredDailyHours: z.coerce.number().min(0).max(24),
  preferredDailyMinutes: z.coerce.number().min(0).max(59),
  theme: z.enum(["SYSTEM", "DARK"]),
  dateFormat: z.string().min(2),
  timeFormat: z.enum(["H12", "H24"])
});

type FormValues = z.infer<typeof schema>;
type FormInput = z.input<typeof schema>;

export function SettingsPreferencesPage() {
  const { t } = useTranslation(["settings", "common"]);
  const queryClient = useQueryClient();
  const { user, refreshCurrentUser } = useAuth();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const safeBack = useSafeBackNavigation({ fallback: "/profile" });
  const detectedTimezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const supportedTimezones = useMemo(getSupportedTimezones, []);
  const preferencesQuery = useQuery({
    queryKey: queryKeys.preferences(),
    queryFn: getPreferences,
    initialData: user?.preferences ?? undefined
  });

  const form = useForm<FormInput, undefined, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toPreferenceFormValues(preferencesQuery.data, detectedTimezone)
  });

  useEffect(() => {
    form.reset(toPreferenceFormValues(preferencesQuery.data, detectedTimezone));
  }, [detectedTimezone, form, preferencesQuery.data]);

  const mutation = useMutation({
    mutationFn: (payload: UpdatePreferencesPayload) => updatePreferences(payload),
    onSuccess: async (nextPreferences) => {
      queryClient.setQueryData(queryKeys.preferences(), nextPreferences);
      applyAppLanguage(nextPreferences.language);
      await refreshCurrentUser();
      setSuccessMessage(t("common:messages.changesSaved"));
    },
    onError: (error) => {
      const apiError = getApiError(error);
      Object.entries(apiError.fieldErrors).forEach(([field, message]) => {
        form.setError(field as keyof FormValues, { message });
      });
    }
  });

  const { confirmOrRun, dialog } = useUnsavedChangesGuard({
    isDirty: form.formState.isDirty && !mutation.isPending
  });

  if (preferencesQuery.isLoading) {
    return <SettingsPageSkeleton />;
  }

  if (preferencesQuery.error) {
    return <ScreenMessage title={t("settings:preferences")} description={getApiError(preferencesQuery.error).message} />;
  }

  return (
    <div className="space-y-8 pb-10">
      <SettingsPageHeader
        title={t("settings:preferences")}
        fallbackHref="/profile"
        onBack={() => confirmOrRun(safeBack)}
      />
      <form
        className="space-y-6"
        onSubmit={form.handleSubmit(async (values) => {
          setSuccessMessage(null);
          await mutation.mutateAsync({
            language: values.language,
            currency: values.currency.toUpperCase(),
            timezone: values.timezone,
            defaultBreakMinutes: values.defaultBreakMinutes,
            preferredDailyMinutes: values.preferredDailyHours * 60 + values.preferredDailyMinutes,
            theme: values.theme,
            dateFormat: values.dateFormat,
            timeFormat: values.timeFormat
          });
        })}
      >
        <SettingsSection title={t("settings:preferencesFields.regional")}>
          <div className="space-y-4">
            <Select label={t("settings:preferencesFields.language")} error={form.formState.errors.language?.message} {...form.register("language")}>
              {["en", "de", "ro"].map((language) => (
                <option key={language} value={language}>
                  {getNativeLanguageName(normalizeLanguage(language))}
                </option>
              ))}
            </Select>
            <Select label={t("settings:preferencesFields.currency")} error={form.formState.errors.currency?.message} {...form.register("currency")}>
              {["EUR", "USD", "GBP", "CHF", "PLN", "RON"].map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </Select>
            <Select label={t("settings:preferencesFields.timezone")} error={form.formState.errors.timezone?.message} {...form.register("timezone")}>
              {supportedTimezones.map((timezone) => (
                <option key={timezone} value={timezone}>
                  {timezone}
                </option>
              ))}
            </Select>
          </div>
        </SettingsSection>

        <SettingsFormActions submitting={mutation.isPending} successMessage={successMessage} />
        {!successMessage && mutation.error ? (
          <p className="text-sm text-red-300">{getApiError(mutation.error).message}</p>
        ) : null}
      </form>
      {dialog}
    </div>
  );
}

function toPreferenceFormValues(
  preferences: Awaited<ReturnType<typeof getPreferences>> | null | undefined,
  detectedTimezone: string
): FormValues {
  const target = preferences?.preferredDailyMinutes ?? 480;
  return {
    language: preferences?.language ?? "en",
    currency: preferences?.currency ?? "EUR",
    timezone: preferences?.timezone ?? detectedTimezone,
    defaultBreakMinutes: preferences?.defaultBreakMinutes ?? 30,
    preferredDailyHours: Math.floor(target / 60),
    preferredDailyMinutes: target % 60,
    theme: preferences?.theme === "DARK" ? "DARK" : "SYSTEM",
    dateFormat: preferences?.dateFormat ?? "DD.MM.YYYY",
    timeFormat: preferences?.timeFormat ?? "H24"
  };
}

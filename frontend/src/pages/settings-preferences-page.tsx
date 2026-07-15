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
import { Input } from "../components/ui/input";
import { ScreenMessage } from "../components/ui/screen-message";
import { Select } from "../components/ui/select";
import { useSafeBackNavigation } from "../hooks/use-safe-back-navigation";
import { useUnsavedChangesGuard } from "../hooks/use-unsaved-changes-guard";
import { applyAppLanguage } from "../i18n";
import { getNativeLanguageName, normalizeLanguage } from "../i18n/language";
import { getSupportedTimezones } from "../utils/timezones";
import { applyAppTheme } from "../utils/theme";

const schema = z.object({
  language: z.string().min(2),
  currency: z.string().length(3),
  timezone: z.string().min(3),
  firstDayOfWeek: z.enum(["MONDAY", "SUNDAY"]),
  defaultBreakMinutes: z.coerce.number().min(0),
  preferredDailyHours: z.coerce.number().min(0).max(24),
  preferredDailyMinutes: z.coerce.number().min(0).max(59),
  paidSickLeave: z.boolean(),
  paidVacation: z.boolean(),
  theme: z.enum(["LIGHT", "SYSTEM", "DARK"]),
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
      applyAppTheme(nextPreferences.theme);
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
            firstDayOfWeek: values.firstDayOfWeek,
            defaultBreakMinutes: values.defaultBreakMinutes,
            preferredDailyMinutes: values.preferredDailyHours * 60 + values.preferredDailyMinutes,
            paidSickLeave: values.paidSickLeave,
            paidVacation: values.paidVacation,
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

        <SettingsSection title={t("settings:preferencesFields.format")}>
          <div className="space-y-4">
            <Select label={t("settings:preferencesFields.firstDayOfWeek")} error={form.formState.errors.firstDayOfWeek?.message} {...form.register("firstDayOfWeek")}>
              <option value="MONDAY">{t("settings:preferencesOptions.monday")}</option>
              <option value="SUNDAY">{t("settings:preferencesOptions.sunday")}</option>
            </Select>
            <Select label={t("settings:preferencesFields.dateFormat")} error={form.formState.errors.dateFormat?.message} {...form.register("dateFormat")}>
              <option value="DD.MM.YYYY">31.12.2026</option>
              <option value="MM/DD/YYYY">12/31/2026</option>
              <option value="YYYY-MM-DD">2026-12-31</option>
            </Select>
            <Select label={t("settings:preferencesFields.timeFormat")} error={form.formState.errors.timeFormat?.message} {...form.register("timeFormat")}>
              <option value="H24">{t("settings:preferencesOptions.time24")}</option>
              <option value="H12">{t("settings:preferencesOptions.time12")}</option>
            </Select>
          </div>
        </SettingsSection>

        <SettingsSection title={t("settings:preferencesFields.appearance")}>
          <Select label={t("settings:preferencesFields.theme")} error={form.formState.errors.theme?.message} {...form.register("theme")}>
            <option value="SYSTEM">{t("settings:preferencesOptions.systemTheme")}</option>
            <option value="LIGHT">{t("settings:preferencesOptions.lightTheme")}</option>
            <option value="DARK">{t("settings:preferencesOptions.darkTheme")}</option>
          </Select>
        </SettingsSection>

        <SettingsSection title={t("settings:preferencesFields.workDefaults")}>
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            label={t("settings:preferencesFields.defaultBreakMinutes")}
            error={form.formState.errors.defaultBreakMinutes?.message}
            {...form.register("defaultBreakMinutes")}
          />
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
    firstDayOfWeek: preferences?.firstDayOfWeek ?? "MONDAY",
    defaultBreakMinutes: preferences?.defaultBreakMinutes ?? 30,
    preferredDailyHours: Math.floor(target / 60),
    preferredDailyMinutes: target % 60,
    paidSickLeave: preferences?.paidSickLeave ?? true,
    paidVacation: preferences?.paidVacation ?? true,
    theme: preferences?.theme ?? "SYSTEM",
    dateFormat: preferences?.dateFormat ?? "DD.MM.YYYY",
    timeFormat: preferences?.timeFormat ?? "H24"
  };
}

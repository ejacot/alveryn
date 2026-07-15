import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { getApiError } from "../api/api-errors";
import { getPreferences, updatePreferences, type UpdatePreferencesPayload } from "../api/endpoints";
import { queryKeys } from "../api/query-keys";
import { SettingsFormActions } from "../components/settings/settings-form-actions";
import { SettingsPageHeader } from "../components/settings/settings-page-header";
import { SettingsPageSkeleton } from "../components/settings/settings-page-skeleton";
import { SettingsSection } from "../components/settings/settings-section";
import { Input } from "../components/ui/input";
import { ScreenMessage } from "../components/ui/screen-message";
import { useAuth } from "../features/auth/use-auth";
import { useSafeBackNavigation } from "../hooks/use-safe-back-navigation";
import { useUnsavedChangesGuard } from "../hooks/use-unsaved-changes-guard";

const schema = z.object({
  preferredDailyHours: z.coerce.number().min(0).max(24),
  preferredDailyMinutes: z.coerce.number().min(0).max(59),
  paidSickLeave: z.boolean(),
  paidVacation: z.boolean()
});

type FormValues = z.infer<typeof schema>;
type FormInput = z.input<typeof schema>;

export function SettingsAbsencePage() {
  const { t } = useTranslation(["settings", "common"]);
  const queryClient = useQueryClient();
  const { user, refreshCurrentUser } = useAuth();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const safeBack = useSafeBackNavigation({ fallback: "/profile" });

  const preferencesQuery = useQuery({
    queryKey: queryKeys.preferences(),
    queryFn: getPreferences,
    initialData: user?.preferences ?? undefined
  });

  const form = useForm<FormInput, undefined, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toAbsenceFormValues(preferencesQuery.data)
  });

  useEffect(() => {
    form.reset(toAbsenceFormValues(preferencesQuery.data));
  }, [form, preferencesQuery.data]);

  const mutation = useMutation({
    mutationFn: (payload: UpdatePreferencesPayload) => updatePreferences(payload),
    onSuccess: async (nextPreferences) => {
      queryClient.setQueryData(queryKeys.preferences(), nextPreferences);
      await refreshCurrentUser();
      form.reset(toAbsenceFormValues(nextPreferences));
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
    return <ScreenMessage title={t("settings:absenceSettings.title")} description={getApiError(preferencesQuery.error).message} />;
  }

  const preferences = preferencesQuery.data ?? user?.preferences;

  return (
    <div className="space-y-8 pb-10">
      <SettingsPageHeader
        title={t("settings:absenceSettings.title")}
        fallbackHref="/profile"
        onBack={() => confirmOrRun(safeBack)}
      />
      <form
        className="space-y-6"
        onSubmit={form.handleSubmit(async (values) => {
          if (!preferences) return;
          setSuccessMessage(null);
          await mutation.mutateAsync({
            language: preferences.language,
            currency: preferences.currency,
            timezone: preferences.timezone,
            firstDayOfWeek: preferences.firstDayOfWeek,
            defaultBreakMinutes: preferences.defaultBreakMinutes,
            preferredDailyMinutes: values.preferredDailyHours * 60 + values.preferredDailyMinutes,
            paidSickLeave: values.paidSickLeave,
            paidVacation: values.paidVacation,
            theme: preferences.theme,
            dateFormat: preferences.dateFormat,
            timeFormat: preferences.timeFormat
          });
        })}
      >
        <SettingsSection title={t("settings:absenceSettings.normalDay")}>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t("settings:preferencesFields.normalDayHours")}
              type="number"
              inputMode="numeric"
              min={0}
              max={24}
              error={form.formState.errors.preferredDailyHours?.message}
              {...form.register("preferredDailyHours", { valueAsNumber: true })}
            />
            <Input
              label={t("settings:preferencesFields.normalDayMinutes")}
              type="number"
              inputMode="numeric"
              min={0}
              max={59}
              error={form.formState.errors.preferredDailyMinutes?.message}
              {...form.register("preferredDailyMinutes", { valueAsNumber: true })}
            />
          </div>
        </SettingsSection>

        <SettingsSection title={t("settings:absenceSettings.paidTypes")}>
          <div className="space-y-3">
            <AbsenceToggle
              label={t("settings:preferencesFields.paidSickLeave")}
              checked={form.watch("paidSickLeave")}
              onChange={(checked) => form.setValue("paidSickLeave", checked, { shouldDirty: true, shouldValidate: true })}
            />
            <AbsenceToggle
              label={t("settings:preferencesFields.paidVacation")}
              checked={form.watch("paidVacation")}
              onChange={(checked) => form.setValue("paidVacation", checked, { shouldDirty: true, shouldValidate: true })}
            />
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

function toAbsenceFormValues(
  preferences: Awaited<ReturnType<typeof getPreferences>> | null | undefined
): FormValues {
  const target = preferences?.preferredDailyMinutes ?? 480;
  return {
    preferredDailyHours: Math.floor(target / 60),
    preferredDailyMinutes: target % 60,
    paidSickLeave: preferences?.paidSickLeave ?? true,
    paidVacation: preferences?.paidVacation ?? true
  };
}

function AbsenceToggle({
  label,
  checked,
  onChange
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-14 items-center justify-between gap-4 rounded-[24px] border border-white/[0.08] bg-white/[0.035] px-4">
      <span className="text-sm font-semibold text-white/78">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-5 w-5 accent-white"
      />
    </label>
  );
}

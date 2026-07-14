import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { getApiError } from "../api/api-errors";
import { queryKeys } from "../api/query-keys";
import {
  createHourlyRate,
  deleteHourlyRate,
  getHourlyRate,
  updateHourlyRate
} from "../api/endpoints";
import { SettingsConfirmDialog } from "../components/settings/settings-confirm-dialog";
import { SettingsFormActions } from "../components/settings/settings-form-actions";
import { SettingsPageHeader } from "../components/settings/settings-page-header";
import { SettingsPageSkeleton } from "../components/settings/settings-page-skeleton";
import { SettingsSection } from "../components/settings/settings-section";
import { ScreenMessage } from "../components/ui/screen-message";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { useSafeBackNavigation } from "../hooks/use-safe-back-navigation";
import { useUnsavedChangesGuard } from "../hooks/use-unsaved-changes-guard";
import { todayLocalIsoDate } from "../utils/date";

function createSchema(t: (key: string) => string) {
  return z
  .object({
    hourlyRate: z.coerce.number().min(0, t("hourlyRateEditor.validation.hourlyRate")),
    currency: z.string().length(3, t("hourlyRateEditor.validation.currency")),
    validFrom: z.string().min(1, t("hourlyRateEditor.validation.validFrom")),
    validTo: z.string().optional()
  })
  .refine((values) => !values.validTo || values.validTo >= values.validFrom, {
    path: ["validTo"],
    message: t("hourlyRateEditor.validation.validToBeforeFrom")
  });
}

type FormValues = z.infer<ReturnType<typeof createSchema>>;
type FormInput = z.input<ReturnType<typeof createSchema>>;

export function HourlyRateEditorPage() {
  const { t } = useTranslation("settings");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { rateId } = useParams();
  const isEditing = Boolean(rateId);
  const [showConfirm, setShowConfirm] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const safeBack = useSafeBackNavigation({ fallback: "/settings/hourly-rates" });

  const rateQuery = useQuery({
    queryKey: rateId ? queryKeys.hourlyRates.detail(rateId) : queryKeys.hourlyRates.all(),
    queryFn: () => getHourlyRate(rateId!),
    enabled: isEditing
  });

  const form = useForm<FormInput, undefined, FormValues>({
    resolver: zodResolver(createSchema(t)),
    defaultValues: {
      hourlyRate: 0,
      currency: "EUR",
      validFrom: todayLocalIsoDate(),
      validTo: ""
    }
  });

  useEffect(() => {
    if (!rateQuery.data) return;
    form.reset({
      hourlyRate: Number(rateQuery.data.hourlyRate),
      currency: rateQuery.data.currency,
      validFrom: rateQuery.data.validFrom,
      validTo: rateQuery.data.validTo ?? ""
    });
  }, [form, rateQuery.data]);

  async function afterSuccess() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.hourlyRates.all() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.workEntries.all() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.statistics.all() })
    ]);
    navigate("/settings/hourly-rates", { replace: true });
  }

  const saveMutation = useMutation({
    mutationFn: (values: FormValues) =>
      isEditing
        ? updateHourlyRate(rateId!, toRatePayload(values))
        : createHourlyRate(toRatePayload(values)),
    onSuccess: async () => {
      setSuccessMessage(isEditing ? t("hourlyRateEditor.updated") : t("hourlyRateEditor.created"));
      await afterSuccess();
    },
    onError: (error) => {
      const apiError = getApiError(error);
      Object.entries(apiError.fieldErrors).forEach(([field, message]) => {
        form.setError(field as keyof FormValues, { message });
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteHourlyRate(rateId!),
    onSuccess: async () => {
      setShowConfirm(false);
      await afterSuccess();
    }
  });

  const { confirmOrRun, dialog } = useUnsavedChangesGuard({
    isDirty:
      form.formState.isDirty &&
      !saveMutation.isPending &&
      !deleteMutation.isPending
  });

  if (rateQuery.isLoading) {
    return <SettingsPageSkeleton />;
  }

  if (rateQuery.error) {
    return <ScreenMessage title={t("hourlyRateEditor.unavailableTitle")} description={getApiError(rateQuery.error).message} />;
  }

  return (
    <div className="space-y-8 pb-10">
      <SettingsPageHeader
        title={isEditing ? t("hourlyRateEditor.editTitle") : t("hourlyRateEditor.addTitle")}
        description={t("hourlyRateEditor.description")}
        fallbackHref="/settings/hourly-rates"
        onBack={() => confirmOrRun(safeBack)}
      />
      <form
        className="space-y-6"
        onSubmit={form.handleSubmit(async (values) => {
          await saveMutation.mutateAsync(values);
        })}
      >
        <SettingsSection title={t("hourlyRateEditor.sectionTitle")}>
          <div className="space-y-4">
            <Input type="number" step="0.01" min={0} label={t("hourlyRateEditor.fields.hourlyRate")} error={form.formState.errors.hourlyRate?.message} {...form.register("hourlyRate")} />
            <Select label={t("hourlyRateEditor.fields.currency")} error={form.formState.errors.currency?.message} {...form.register("currency")}>
              {["EUR", "USD", "GBP", "CHF", "PLN", "RON"].map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </Select>
            <Input type="date" label={t("hourlyRateEditor.fields.validFrom")} error={form.formState.errors.validFrom?.message} {...form.register("validFrom")} />
            <Input type="date" label={t("hourlyRateEditor.fields.validTo")} error={form.formState.errors.validTo?.message} {...form.register("validTo")} />
          </div>
        </SettingsSection>

        <SettingsFormActions
          submitting={saveMutation.isPending}
          successMessage={successMessage}
          onDelete={isEditing ? () => setShowConfirm(true) : undefined}
          deleteLabel={isEditing ? t("hourlyRateEditor.deleteLabel") : undefined}
          deleteDisabled={deleteMutation.isPending}
        />
        {saveMutation.error ? <p className="text-sm text-red-300">{getApiError(saveMutation.error).message}</p> : null}
      </form>

      <SettingsConfirmDialog
        open={showConfirm}
        title={t("hourlyRateEditor.deleteTitle")}
        description={t("hourlyRateEditor.deleteDescription")}
        confirmLabel={t("hourlyRateEditor.deleteConfirm")}
        pending={deleteMutation.isPending}
        onCancel={() => setShowConfirm(false)}
        onConfirm={() => void deleteMutation.mutateAsync()}
      />
      {dialog}
    </div>
  );
}

function toRatePayload(values: FormValues) {
  return {
    hourlyRate: values.hourlyRate,
    currency: values.currency.toUpperCase(),
    validFrom: values.validFrom,
    validTo: values.validTo?.trim() ? values.validTo : null
  };
}

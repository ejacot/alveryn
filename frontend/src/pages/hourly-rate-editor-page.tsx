import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
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
import { SettingsContextCard } from "../components/settings/settings-context-card";
import { SettingsPageSkeleton } from "../components/settings/settings-page-skeleton";
import { ScreenMessage } from "../components/ui/screen-message";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { useSafeBackNavigation } from "../hooks/use-safe-back-navigation";
import { useUnsavedChangesGuard } from "../hooks/use-unsaved-changes-guard";
import { todayLocalIsoDate } from "../utils/date";

function createSchema(t: (key: string) => string) {
  return z
  .object({
    hourlyRate: z.preprocess(
      (value) => typeof value === "string" ? value.replace(",", ".") : value,
      z.coerce.number().min(0, t("hourlyRateEditor.validation.hourlyRate"))
    ),
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
  const [suppressUnsavedGuard, setSuppressUnsavedGuard] = useState(false);
  const [hourlyRateClearedOnFocus, setHourlyRateClearedOnFocus] = useState(false);
  const safeBack = useSafeBackNavigation({ fallback: "/settings/hourly-rates" });

  const rateQuery = useQuery({
    queryKey: rateId ? queryKeys.hourlyRates.detail(rateId) : queryKeys.hourlyRates.all(),
    queryFn: () => getHourlyRate(rateId!),
    enabled: isEditing
  });

  const form = useForm<FormInput, undefined, FormValues>({
    resolver: zodResolver(createSchema(t)),
    defaultValues: {
      hourlyRate: "0",
      currency: "EUR",
      validFrom: todayLocalIsoDate(),
      validTo: ""
    }
  });

  useEffect(() => {
    if (!rateQuery.data) return;
    form.reset({
      hourlyRate: rateQuery.data.hourlyRate,
      currency: rateQuery.data.currency,
      validFrom: rateQuery.data.validFrom,
      validTo: rateQuery.data.validTo ?? ""
    });
  }, [form, rateQuery.data]);

  async function afterSuccess() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.hourlyRates.all() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.workRecords.all() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.statistics.all() })
    ]);
    window.setTimeout(() => navigate("/settings/hourly-rates", { replace: true }), 520);
  }

  const saveMutation = useMutation({
    mutationFn: (values: FormValues) =>
      isEditing
        ? updateHourlyRate(rateId!, toRatePayload(values))
        : createHourlyRate(toRatePayload(values)),
    onSuccess: async () => {
      setSuppressUnsavedGuard(true);
      form.reset(form.getValues());
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
      setSuppressUnsavedGuard(true);
      setShowConfirm(false);
      await afterSuccess();
    }
  });

  const { confirmOrRun, dialog } = useUnsavedChangesGuard({
    isDirty:
      !suppressUnsavedGuard &&
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

  const title = isEditing ? t("hourlyRateEditor.editTitle") : t("hourlyRateEditor.addTitle");
  const hourlyRateField = form.register("hourlyRate");

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4 py-[calc(env(safe-area-inset-top)+1.5rem)] backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="hourly-rate-title"
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label={t("hourlyRateEditor.cancel")}
        className="absolute inset-0 h-full w-full cursor-default"
        onClick={() => confirmOrRun(safeBack)}
      />
      <form
        className="relative z-10 w-full max-w-sm rounded-[32px] border border-white/[0.08] bg-[#090909]/95 p-5 shadow-[0_28px_90px_rgba(0,0,0,0.55)]"
        onSubmit={form.handleSubmit(async (values) => {
          await saveMutation.mutateAsync(values);
        })}
      >
        <div className="mb-5 flex items-center justify-between gap-4">
          <h1 id="hourly-rate-title" className="text-xl font-semibold tracking-[-0.06em] text-white">
            {title}
          </h1>
          <button
            type="button"
            onClick={() => confirmOrRun(safeBack)}
            className="rounded-full px-3 py-2 text-sm font-semibold text-white/48 transition hover:text-white"
          >
            {t("hourlyRateEditor.cancel")}
          </button>
        </div>

        <div className="mb-5">
          <SettingsContextCard context="hourlyRateEditor" />
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-3">
            <Input
              type="text"
              inputMode="decimal"
              label={t("hourlyRateEditor.fields.hourlyRate")}
              error={form.formState.errors.hourlyRate?.message}
              {...hourlyRateField}
              onFocus={() => {
                if (hourlyRateClearedOnFocus) {
                  return;
                }

                setHourlyRateClearedOnFocus(true);
                form.setValue("hourlyRate", "", { shouldDirty: true, shouldTouch: true });
              }}
            />
            <Select label={t("hourlyRateEditor.fields.currency")} error={form.formState.errors.currency?.message} {...form.register("currency")}>
              {["EUR", "USD", "GBP", "CHF", "PLN", "RON"].map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              type="date"
              className="!mx-0 !max-w-none"
              label={t("hourlyRateEditor.fields.validFrom")}
              error={form.formState.errors.validFrom?.message}
              {...form.register("validFrom")}
            />
            <Input
              type="date"
              className="!mx-0 !max-w-none"
              label={t("hourlyRateEditor.fields.validTo")}
              error={form.formState.errors.validTo?.message}
              {...form.register("validTo")}
            />
          </div>
        </div>

        {saveMutation.error ? <p className="mt-4 text-sm text-red-300">{getApiError(saveMutation.error).message}</p> : null}
        <div className="mt-6 flex items-center gap-3">
          {isEditing ? (
            <button
              type="button"
              disabled={deleteMutation.isPending || saveMutation.isPending}
              onClick={() => setShowConfirm(true)}
              className="min-h-12 rounded-full px-4 text-sm font-semibold text-red-200/90 transition hover:text-red-100 disabled:opacity-50"
            >
              {t("hourlyRateEditor.deleteLabel")}
            </button>
          ) : null}
          <button
            type="submit"
            disabled={saveMutation.isPending || deleteMutation.isPending}
            className="ml-auto min-h-12 rounded-full bg-white px-6 text-sm font-semibold tracking-[-0.02em] text-black shadow-[0_16px_40px_rgba(255,255,255,0.12)] transition hover:bg-white/90 disabled:opacity-55"
          >
            {saveMutation.isPending ? t("hourlyRateEditor.saving") : t("hourlyRateEditor.save")}
          </button>
        </div>
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
      {successMessage ? (
        <div className="glass-panel fixed inset-x-6 top-24 z-[80] mx-auto max-w-sm rounded-[28px] px-5 py-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-black">
            <Check className="h-6 w-6" />
          </div>
          <p className="mt-3 text-base font-semibold text-white">{successMessage}</p>
        </div>
      ) : null}
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

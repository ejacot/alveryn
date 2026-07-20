import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { getApiError } from "../api/api-errors";
import { queryKeys } from "../api/query-keys";
import {
  createHourlyRate,
  deleteHourlyRate,
  getHourlyRate,
  listEmployments,
  updateHourlyRate
} from "../api/endpoints";
import { SettingsConfirmDialog } from "../components/settings/settings-confirm-dialog";
import { SettingsContextCard } from "../components/settings/settings-context-card";
import { SettingsPageSkeleton } from "../components/settings/settings-page-skeleton";
import { ScreenMessage } from "../components/ui/screen-message";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Card } from "../components/ui/card";
import { LockedModalViewport } from "../components/ui/locked-modal-viewport";
import { ModalPanel } from "../components/ui/modal-panel";
import { ModalActions } from "../components/ui/modal-actions";
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
    employmentId: z.string().min(1, t("hourlyRateEditor.validation.employment")),
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
  const [searchParams] = useSearchParams();
  const requestedEmploymentId = searchParams.get("employmentId") ?? "";
  const isEditing = Boolean(rateId);
  const [showConfirm, setShowConfirm] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [suppressUnsavedGuard, setSuppressUnsavedGuard] = useState(false);
  const [hourlyRateClearedOnFocus, setHourlyRateClearedOnFocus] = useState(false);
  const ratesPath = requestedEmploymentId
    ? `/settings/hourly-rates?employmentId=${requestedEmploymentId}`
    : "/settings/hourly-rates";
  const safeBack = useSafeBackNavigation({ fallback: ratesPath });

  const employmentsQuery = useQuery({
    queryKey: queryKeys.employments.all(),
    queryFn: listEmployments,
    enabled: !requestedEmploymentId
  });

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
      employmentId: requestedEmploymentId,
      validFrom: todayLocalIsoDate(),
      validTo: ""
    }
  });

  useEffect(() => {
    if (!rateQuery.data) return;
    form.reset({
      hourlyRate: rateQuery.data.hourlyRate,
      currency: rateQuery.data.currency,
      employmentId: rateQuery.data.employmentId ?? requestedEmploymentId,
      validFrom: rateQuery.data.validFrom,
      validTo: rateQuery.data.validTo ?? ""
    });
  }, [form, rateQuery.data, requestedEmploymentId]);

  async function afterSuccess() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.hourlyRates.all() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.workRecords.all() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.statistics.all() })
    ]);
      const employmentId = form.getValues("employmentId");
      const path = employmentId ? `/settings/hourly-rates?employmentId=${employmentId}` : "/settings/hourly-rates";
      window.setTimeout(() => navigate(path, { replace: true }), 520);
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

  if (rateQuery.isLoading || employmentsQuery.isLoading) {
    return <SettingsPageSkeleton />;
  }

  if (rateQuery.error || employmentsQuery.error) {
    return <ScreenMessage title={t("hourlyRateEditor.unavailableTitle")} description={getApiError(rateQuery.error ?? employmentsQuery.error).message} />;
  }

  const title = isEditing ? t("hourlyRateEditor.editTitle") : t("hourlyRateEditor.addTitle");
  const hourlyRateField = form.register("hourlyRate");

  return (
    <LockedModalViewport
      className="z-[60] bg-black/50 px-4 py-4 backdrop-blur-sm"
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
      <ModalPanel
        as="form"
        className="max-w-sm"
        onSubmit={form.handleSubmit(async (values) => {
          await saveMutation.mutateAsync(values);
        })}
      >
        <div className="mb-5">
          <h1 id="hourly-rate-title" className="text-xl font-semibold tracking-[-0.06em] text-white">
            {title}
          </h1>
        </div>

        <div className="mb-5">
          <SettingsContextCard context="hourlyRateEditor" />
        </div>

        <div className="space-y-3">
          {!requestedEmploymentId ? (
            <Select
              label={t("hourlyRateEditor.fields.employment")}
              error={form.formState.errors.employmentId?.message}
              disabled={isEditing}
              {...form.register("employmentId")}
            >
              <option value="">{t("hourlyRateEditor.selectEmployment")}</option>
              {(employmentsQuery.data ?? [])
                .filter((employment) => employment.active || employment.id === form.getValues("employmentId"))
                .map((employment) => (
                  <option key={employment.id} value={employment.id}>{employment.name}</option>
                ))}
            </Select>
          ) : null}
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
        <div className="mt-6 space-y-3">
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
          <ModalActions
            cancelLabel={t("hourlyRateEditor.cancel")}
            saveLabel={saveMutation.isPending ? t("hourlyRateEditor.saving") : t("hourlyRateEditor.save")}
            pending={saveMutation.isPending || deleteMutation.isPending}
            onCancel={() => confirmOrRun(safeBack)}
          />
        </div>
      </ModalPanel>

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
        <Card variant="panel" className="fixed inset-x-6 top-24 z-[80] mx-auto max-w-sm rounded-[28px] px-5 py-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-black">
            <Check className="h-6 w-6" />
          </div>
          <p className="mt-3 text-base font-semibold text-white">{successMessage}</p>
        </Card>
      ) : null}
    </LockedModalViewport>
  );
}

function toRatePayload(values: FormValues) {
  return {
    employmentId: values.employmentId,
    hourlyRate: values.hourlyRate,
    currency: values.currency.toUpperCase(),
    validFrom: values.validFrom,
    validTo: values.validTo?.trim() ? values.validTo : null
  };
}

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { getApiError } from "../api/api-errors";
import {
  createEmployment,
  deleteEmployment,
  listHourlyRates,
  listEmployments,
  updateEmployment,
  type EmploymentPayload
} from "../api/endpoints";
import { queryKeys } from "../api/query-keys";
import { SettingsConfirmDialog } from "../components/settings/settings-confirm-dialog";
import { SettingsEmptyState } from "../components/settings/settings-empty-state";
import { SettingsFormActions } from "../components/settings/settings-form-actions";
import { SettingsPageSkeleton } from "../components/settings/settings-page-skeleton";
import { SettingsNavigationHeader } from "../components/settings/settings-navigation-header";
import { SettingsSection } from "../components/settings/settings-section";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { LockedModalViewport } from "../components/ui/locked-modal-viewport";
import { ModalPanel } from "../components/ui/modal-panel";
import { ModalActions } from "../components/ui/modal-actions";
import { ScreenMessage } from "../components/ui/screen-message";
import { Select } from "../components/ui/select";
import { useSafeBackNavigation } from "../hooks/use-safe-back-navigation";
import { useUnsavedChangesGuard } from "../hooks/use-unsaved-changes-guard";
import type { Employment, HourlyRatePeriod, TargetPeriod, TrackingFocus } from "../types/configuration";
import { todayLocalIsoDate } from "../utils/date";

const trackingFocuses: TrackingFocus[] = ["TIME", "EARNINGS"];
const targetPeriods: TargetPeriod[] = ["WEEKLY", "MONTHLY"];

function createSchema(t: (key: string) => string) {
  return z
    .object({
      name: z.string().trim().min(1, t("employment.validation.nameRequired")).max(120, t("employment.validation.nameTooLong")),
      trackingFocus: z.enum(trackingFocuses),
      hourBalanceEnabled: z.boolean(),
      termsValidFrom: z.string().min(1, t("employment.validation.termsValidFrom")),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      targetHours: z.string().optional(),
      targetPeriod: z.enum(targetPeriods),
      hourBalanceValidityMonths: z.string().optional(),
      active: z.boolean()
    })
    .superRefine((values, context) => {
      if (values.startDate && values.endDate && values.endDate < values.startDate) {
        context.addIssue({ code: "custom", path: ["endDate"], message: t("employment.validation.endBeforeStart") });
      }

      if (values.trackingFocus === "TIME" && values.hourBalanceEnabled) {
        const targetHours = Number(values.targetHours);
        const validityMonths = Number(values.hourBalanceValidityMonths);
        if (!Number.isFinite(targetHours) || targetHours <= 0) {
          context.addIssue({ code: "custom", path: ["targetHours"], message: t("employment.validation.targetHours") });
        }
        if (!Number.isInteger(validityMonths) || validityMonths <= 0) {
          context.addIssue({ code: "custom", path: ["hourBalanceValidityMonths"], message: t("employment.validation.validityMonths") });
        }
      }
    });
}

type FormValues = z.infer<ReturnType<typeof createSchema>>;

export function SettingsEmploymentPage() {
  const { t } = useTranslation(["settings", "common"]);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedEditId = searchParams.get("edit");
  const queryClient = useQueryClient();
  const safeBack = useSafeBackNavigation({ fallback: "/profile" });
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedEmployment, setSelectedEmployment] = useState<Employment | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pendingTermsValues, setPendingTermsValues] = useState<FormValues | null>(null);
  const [termsDateChoice, setTermsDateChoice] = useState<"TODAY" | "MONTH_START" | "CUSTOM">("TODAY");
  const [customTermsDate, setCustomTermsDate] = useState(todayLocalIsoDate());

  const employmentsQuery = useQuery({
    queryKey: queryKeys.employments.all(),
    queryFn: listEmployments
  });
  const hourlyRatesQuery = useQuery({
    queryKey: queryKeys.hourlyRates.all(),
    queryFn: listHourlyRates
  });
  const currentRateByEmploymentId = useMemo(() => {
    const today = todayLocalIsoDate();
    return (hourlyRatesQuery.data ?? [])
      .filter((rate) => rate.employmentId && rate.validFrom <= today && (!rate.validTo || rate.validTo >= today))
      .sort((left, right) => right.validFrom.localeCompare(left.validFrom))
      .reduce<Map<string, HourlyRatePeriod>>((rates, rate) => {
        if (rate.employmentId && !rates.has(rate.employmentId)) rates.set(rate.employmentId, rate);
        return rates;
      }, new Map());
  }, [hourlyRatesQuery.data]);

  const schema = createSchema((key) => t(`settings:${key}`));
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyFormValues()
  });
  const trackingFocus = useWatch({ control: form.control, name: "trackingFocus" });
  const hourBalanceEnabled = useWatch({ control: form.control, name: "hourBalanceEnabled" });

  const submitEmployment = async (values: FormValues) => {
    setSuccessMessage(null);
    if (!selectedEmployment) {
      await saveMutation.mutateAsync({
        ...values,
        termsValidFrom: normalizeOptional(values.startDate) ?? todayLocalIsoDate()
      });
      return;
    }
    if (contractTermsChanged(values, selectedEmployment)) {
      setTermsDateChoice("TODAY");
      setCustomTermsDate(todayLocalIsoDate());
      setPendingTermsValues(values);
      return;
    }
    await saveMutation.mutateAsync({ ...values, termsValidFrom: selectedEmployment.termsValidFrom });
  };

  useEffect(() => {
    if (!requestedEditId || !employmentsQuery.data || selectedEmployment?.id === requestedEditId) return;
    const requested = employmentsQuery.data.find((employment) => employment.id === requestedEditId);
    if (!requested) return;
    setSelectedEmployment(requested);
    setSuccessMessage(null);
    form.reset(toFormValues(requested));
    setEditorOpen(true);
  }, [employmentsQuery.data, form, requestedEditId, selectedEmployment?.id]);

  const saveMutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = toPayload(values, selectedEmployment?.displayOrder ?? null);
      return selectedEmployment
        ? updateEmployment(selectedEmployment.id, payload)
        : createEmployment(payload);
    },
    onSuccess: async (employment) => {
      const wasCreating = !selectedEmployment;
      await queryClient.invalidateQueries({ queryKey: queryKeys.employments.all() });
      queryClient.setQueryData(queryKeys.employments.detail(employment.id), employment);
      setSuccessMessage(t("settings:employment.saved"));
      if (wasCreating) {
        setEditorOpen(false);
        setSelectedEmployment(null);
        form.reset(emptyFormValues());
        return;
      }
      setSelectedEmployment(employment);
      form.reset(toFormValues(employment));
    },
    onError: (error) => {
      const apiError = getApiError(error);
      Object.entries(apiError.fieldErrors).forEach(([field, message]) => {
        form.setError(field as keyof FormValues, { message });
      });
    }
  });

  const removeMutation = useMutation({
    mutationFn: () => deleteEmployment(selectedEmployment!.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.employments.all() });
      setDeleteDialogOpen(false);
      setEditorOpen(false);
      setSelectedEmployment(null);
      form.reset(emptyFormValues());
    }
  });

  const { confirmOrRun, dialog } = useUnsavedChangesGuard({
    isDirty: editorOpen && form.formState.isDirty && !saveMutation.isPending
  });

  const closeEditor = () => {
    setEditorOpen(false);
    setSelectedEmployment(null);
    setSuccessMessage(null);
    form.reset(emptyFormValues());
  };

  const openCreate = () => {
    setSelectedEmployment(null);
    setSuccessMessage(null);
    form.reset(emptyFormValues());
    setEditorOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleBack = () => {
    if (editorOpen) {
      confirmOrRun(() => {
        const employmentId = selectedEmployment?.id;
        closeEditor();
        if (requestedEditId && employmentId) navigate(`/settings/employment/${employmentId}`, { replace: true });
      });
    } else {
      safeBack();
    }
  };

  if (employmentsQuery.isLoading) return <SettingsPageSkeleton />;
  if (employmentsQuery.error) {
    return <ScreenMessage title={t("settings:employment.listTitle")} description={getApiError(employmentsQuery.error).message} />;
  }

  const pageTitle = editorOpen
    ? selectedEmployment
      ? t("settings:employment.editTitle")
      : t("settings:employment.createTitle")
    : t((employmentsQuery.data?.length ?? 0) > 1 ? "settings:employment.listTitle" : "settings:employment.title");
  const showIdentity = !selectedEmployment;
  const showContract = true;

  return (
    <div className="mx-auto w-full max-w-[560px] space-y-6 pb-10 pt-8">
      <SettingsNavigationHeader
        title={pageTitle}
        backLabel={t("common:actions.back")}
        onBack={handleBack}
        action={!editorOpen && (employmentsQuery.data?.length ?? 0) > 0 ? {
          label: t("settings:employment.add"),
          icon: <Plus className="h-5 w-5" aria-hidden="true" />,
          onClick: openCreate
        } : undefined}
      />

      {editorOpen ? (
        <form
          className="space-y-6"
          onSubmit={form.handleSubmit(submitEmployment)}
        >
          {showIdentity ? (
            <SettingsSection title={t("settings:employment.sections.identity")}>
              <div className="space-y-4">
                <Input label={t("settings:employment.fields.name")} error={form.formState.errors.name?.message} {...form.register("name")} />
              </div>
            </SettingsSection>
          ) : null}

          {showContract ? <SettingsSection title={t("settings:employment.sections.tracking")}>
            <div className="grid grid-cols-2 gap-3" role="radiogroup">
                {trackingFocuses.map((focus) => {
                  const selected = trackingFocus === focus;
                  return (
                    <button
                      key={focus}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => form.setValue("trackingFocus", focus, { shouldDirty: true, shouldValidate: true })}
                      className={`flex min-h-14 items-center justify-between gap-3 rounded-[1.15rem] border px-4 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-white/24 ${
                        selected ? "border-white/55 bg-white/[0.11]" : "border-white/[0.09] bg-white/[0.025]"
                      }`}
                    >
                      <span className="font-medium text-white">{t(`settings:employment.tracking.${focus}.summaryTitle`)}</span>
                      <span className={`h-4 w-4 shrink-0 rounded-full border ${selected ? "border-[5px] border-white" : "border-white/25"}`} aria-hidden="true" />
                    </button>
                  );
                })}
            </div>
          </SettingsSection> : null}

          {!selectedEmployment ? <SettingsSection title={t("settings:employment.sections.period")}>
            <div className="space-y-4">
              <Input type="date" label={t("settings:employment.fields.startDate")} error={form.formState.errors.startDate?.message} {...form.register("startDate")} />
              <Input type="date" label={t("settings:employment.fields.endDate")} error={form.formState.errors.endDate?.message} {...form.register("endDate")} />
            </div>
          </SettingsSection> : null}

          {showContract && trackingFocus === "TIME" ? (
            <SettingsSection title={t("settings:employment.sections.hourBalance")}>
              <div className="space-y-4">
                <button
                  type="button"
                  role="switch"
                  aria-checked={hourBalanceEnabled}
                  onClick={() => form.setValue("hourBalanceEnabled", !hourBalanceEnabled, { shouldDirty: true, shouldValidate: true })}
                  className="flex w-full items-center justify-between gap-4 text-left"
                >
                  <span>
                    <span className="block font-medium text-white">{t("settings:employment.fields.hourBalance")}</span>
                    <span className="mt-1 block text-sm text-white/46">{t("settings:employment.help.hourBalance")}</span>
                  </span>
                  <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${hourBalanceEnabled ? "bg-white" : "bg-white/[0.12]"}`}>
                    <span className={`absolute top-1 h-5 w-5 rounded-full transition ${hourBalanceEnabled ? "left-6 bg-black" : "left-1 bg-white/55"}`} />
                  </span>
                </button>
                {hourBalanceEnabled ? (
                  <div className="space-y-4 border-t border-white/[0.08] pt-4">
                    <Input type="number" min="0.01" step="0.01" label={t("settings:employment.fields.targetHours")} helperText={t("settings:employment.help.targetHours")} error={form.formState.errors.targetHours?.message} {...form.register("targetHours")} />
                    <Select label={t("settings:employment.fields.targetPeriod")} error={form.formState.errors.targetPeriod?.message} {...form.register("targetPeriod")}>
                      {targetPeriods.map((period) => <option key={period} value={period}>{t(`settings:employment.targetPeriods.${period}`)}</option>)}
                    </Select>
                    <Input type="number" min="1" step="1" label={t("settings:employment.fields.validityMonths")} helperText={t("settings:employment.help.validityMonths")} error={form.formState.errors.hourBalanceValidityMonths?.message} {...form.register("hourBalanceValidityMonths")} />
                  </div>
                ) : null}
              </div>
            </SettingsSection>
          ) : null}

          <SettingsFormActions
            submitting={saveMutation.isPending}
            successMessage={successMessage}
            submitLabel={selectedEmployment ? t("common:actions.saveChanges") : t("settings:employment.create")}
            onDelete={selectedEmployment && showIdentity ? () => setDeleteDialogOpen(true) : undefined}
            deleteLabel={selectedEmployment ? t(selectedEmployment.deletable ? "settings:employment.delete" : "settings:employment.deactivate") : undefined}
            deleteDisabled={removeMutation.isPending}
          />
          {!successMessage && saveMutation.error ? <p className="text-sm text-red-300">{getApiError(saveMutation.error).message}</p> : null}
          {removeMutation.error ? <p className="text-sm text-red-300">{getApiError(removeMutation.error).message}</p> : null}
        </form>
      ) : (
        <section className="space-y-4">
          {(employmentsQuery.data ?? []).length ? (
            (employmentsQuery.data ?? []).map((employment) => (
              <Card
                as="button"
                type="button"
                key={employment.id}
                onClick={() => navigate(`/settings/employment/${employment.id}`)}
                className="flex min-h-[5.25rem] w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-white/24 focus:ring-inset"
              >
                <span className="min-w-0 flex-1">
                  <span className={`font-name block truncate text-[1.05rem] font-semibold tracking-[-0.04em] ${employment.active ? "text-white" : "text-white/42"}`}>
                    {employment.name}
                  </span>
                  <span className="mt-1 block truncate text-sm text-white/48">
                    {employment.active
                      ? employmentSummary(employment, t)
                      : `${employmentSummary(employment, t)} · ${t("settings:status.inactive")}`}
                  </span>
                  {currentRateByEmploymentId.get(employment.id) ? (
                    <span className="mt-1 block truncate text-sm text-white/38">
                      {t("settings:employment.currentHourlyRate")} · {currentRateByEmploymentId.get(employment.id)!.hourlyRate} {currentRateByEmploymentId.get(employment.id)!.currency}
                    </span>
                  ) : null}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-white/24" aria-hidden="true" />
              </Card>
            ))
          ) : (
            <SettingsEmptyState
              title={t("settings:employment.emptyTitle")}
              actionLabel={t("settings:employment.add")}
              onAction={openCreate}
            />
          )}
        </section>
      )}

      <SettingsConfirmDialog
        open={deleteDialogOpen}
        title={t(selectedEmployment?.deletable ? "settings:employment.deleteTitle" : "settings:employment.deactivateTitle")}
        description={t(selectedEmployment?.deletable ? "settings:employment.deleteDescription" : "settings:employment.deactivateDescription")}
        confirmLabel={t(selectedEmployment?.deletable ? "settings:employment.delete" : "settings:employment.deactivate")}
        pending={removeMutation.isPending}
        onCancel={() => setDeleteDialogOpen(false)}
        onConfirm={() => removeMutation.mutate()}
      />
      {pendingTermsValues ? (
        <LockedModalViewport className="bg-black/55 px-4 py-4 backdrop-blur-sm">
          <ModalPanel role="dialog" aria-modal="true" aria-labelledby="employment-terms-date-title" className="max-w-sm">
            <h2 id="employment-terms-date-title" className="text-[1.2rem] font-semibold tracking-[-0.05em] text-white">
              {t("settings:employment.applyChanges.title")}
            </h2>
            <p className="mt-2 text-sm leading-6 text-white/50">{t("settings:employment.applyChanges.description")}</p>
            <div className="mt-5 space-y-2" role="radiogroup">
              {(["TODAY", "MONTH_START", "CUSTOM"] as const).map((choice) => (
                <button
                  key={choice}
                  type="button"
                  role="radio"
                  aria-checked={termsDateChoice === choice}
                  onClick={() => setTermsDateChoice(choice)}
                  className={`flex min-h-12 w-full items-center justify-between rounded-2xl border px-4 text-left text-sm transition ${termsDateChoice === choice ? "border-white/45 bg-white/[0.1] text-white" : "border-white/[0.07] text-white/58"}`}
                >
                  {t(`settings:employment.applyChanges.${choice}`)}
                  <span className={`h-4 w-4 rounded-full border ${termsDateChoice === choice ? "border-[5px] border-white" : "border-white/25"}`} />
                </button>
              ))}
            </div>
            {termsDateChoice === "CUSTOM" ? (
              <div className="mt-4">
                <Input type="date" label={t("settings:employment.applyChanges.customDate")} value={customTermsDate} onChange={(event) => setCustomTermsDate(event.currentTarget.value)} />
              </div>
            ) : null}
            <ModalActions
              className="mt-6"
              cancelLabel={t("common:actions.cancel")}
              saveLabel={saveMutation.isPending ? t("common:actions.working") : t("settings:employment.applyChanges.confirm")}
              pending={saveMutation.isPending}
              saveDisabled={termsDateChoice === "CUSTOM" && !customTermsDate}
              onCancel={() => setPendingTermsValues(null)}
              onSave={async () => {
                  const termsValidFrom = termsDateChoice === "TODAY"
                    ? todayLocalIsoDate()
                    : termsDateChoice === "MONTH_START"
                      ? `${todayLocalIsoDate().slice(0, 8)}01`
                      : customTermsDate;
                  await saveMutation.mutateAsync({ ...pendingTermsValues, termsValidFrom });
                  setPendingTermsValues(null);
              }}
            />
          </ModalPanel>
        </LockedModalViewport>
      ) : null}
      {dialog}
    </div>
  );
}

function emptyFormValues(): FormValues {
  return {
    name: "",
    trackingFocus: "TIME",
    hourBalanceEnabled: false,
    termsValidFrom: todayLocalIsoDate(),
    startDate: "",
    endDate: "",
    targetHours: "160",
    targetPeriod: "MONTHLY",
    hourBalanceValidityMonths: "12",
    active: true
  };
}

function toFormValues(employment: Employment): FormValues {
  return {
    name: employment.name,
    trackingFocus: employment.trackingFocus,
    hourBalanceEnabled: employment.hourBalanceEnabled,
    termsValidFrom: employment.termsValidFrom,
    startDate: employment.startDate ?? "",
    endDate: employment.endDate ?? "",
    targetHours: employment.targetMinutes ? String(employment.targetMinutes / 60) : "160",
    targetPeriod: employment.targetPeriod ?? "MONTHLY",
    hourBalanceValidityMonths: String(employment.hourBalanceValidityMonths ?? 12),
    active: employment.active
  };
}

function toPayload(values: FormValues, displayOrder: number | null): EmploymentPayload {
  const balanceEnabled = values.trackingFocus === "TIME" && values.hourBalanceEnabled;
  return {
    name: values.name.trim(),
    employmentType: null,
    compensationType: null,
    trackingFocus: values.trackingFocus,
    hourBalanceEnabled: balanceEnabled,
    termsValidFrom: values.termsValidFrom,
    startDate: normalizeOptional(values.startDate),
    endDate: normalizeOptional(values.endDate),
    fixedSalaryAmount: null,
    currency: null,
    targetMinutes: balanceEnabled ? Math.round(Number(values.targetHours) * 60) : null,
    targetPeriod: balanceEnabled ? values.targetPeriod : null,
    hourBalanceValidityMonths: balanceEnabled ? Number(values.hourBalanceValidityMonths) : null,
    active: values.active,
    displayOrder
  };
}

function normalizeOptional(value?: string | null) {
  const normalized = value?.trim() ?? "";
  return normalized || null;
}

function contractTermsChanged(values: FormValues, employment: Employment) {
  const balanceEnabled = values.trackingFocus === "TIME" && values.hourBalanceEnabled;
  const targetMinutes = balanceEnabled ? Math.round(Number(values.targetHours) * 60) : null;
  const targetPeriod = balanceEnabled ? values.targetPeriod : null;
  return values.trackingFocus !== employment.trackingFocus
    || balanceEnabled !== employment.hourBalanceEnabled
    || targetMinutes !== employment.targetMinutes
    || targetPeriod !== employment.targetPeriod;
}

function employmentSummary(employment: Employment, t: (key: string, options?: Record<string, unknown>) => string) {
  const parts = [t(`settings:employment.tracking.${employment.trackingFocus}.summaryTitle`)];
  if (employment.hourBalanceEnabled && employment.targetMinutes && employment.targetPeriod) {
    parts.push(t("settings:employment.targetSummary", {
      hours: employment.targetMinutes / 60,
      period: t(`settings:employment.targetPeriods.${employment.targetPeriod}`).toLowerCase()
    }));
  }
  return parts.join(" · ");
}

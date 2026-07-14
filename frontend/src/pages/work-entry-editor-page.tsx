import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm, type UseFormSetError } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, CalendarDays, Check, Clock3, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useOutletContext, useParams, useSearchParams } from "react-router-dom";
import {
  createWorkEntry,
  deleteWorkEntry,
  getWorkEntry,
  listHourlyRates,
  listUnitTypes,
  listWorkTypes,
  updateWorkEntry
} from "../api/endpoints";
import { getApiError } from "../api/api-errors";
import { queryKeys } from "../api/query-keys";
import { UnitItemRows } from "../components/work-entry/unit-item-rows";
import { WorkEntrySummaryCard } from "../components/work-entry/work-entry-summary-card";
import { WorkTypePicker } from "../components/work-entry/work-type-picker";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { ScreenMessage } from "../components/ui/screen-message";
import { Textarea } from "../components/ui/textarea";
import { formatLocalIsoDate } from "../utils/date";
import {
  calculateGrossAmount,
  calculateTimeEntryMinutes,
  calculateUnitEntryMinutes,
  findApplicableHourlyRate,
  workTypeIsTimeBased,
  workTypeIsUnitBased
} from "../features/work-entries/work-entry-calculations";
import {
  createWorkEntrySchema,
  type WorkEntryFormInput,
  type WorkEntryFormValues
} from "../features/work-entries/work-entry-schemas";
import type { UnitType, WorkType } from "../types/configuration";

type OutletContext = {
  selectedDate?: Date;
};

type RawUnitRow = {
  unitTypeId?: string;
  quantity?: unknown;
};

export function WorkEntryEditorPage() {
  const navigate = useNavigate();
  const { t } = useTranslation(["entries", "common"]);
  const location = useLocation();
  const queryClient = useQueryClient();
  const { entryId } = useParams();
  const [searchParams] = useSearchParams();
  const outletContext = useOutletContext<OutletContext>();
  const isEditing = Boolean(entryId);
  const prefilledDate = !isEditing ? searchParams.get("date") : null;
  const selectedDate = useMemo(() => {
    if (prefilledDate) {
      return new Date(`${prefilledDate}T12:00:00`);
    }

    return outletContext?.selectedDate ?? new Date();
  }, [outletContext?.selectedDate, prefilledDate]);
  const returnTo =
    (location.state as { returnTo?: string } | null)?.returnTo ?? "/";
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [successState, setSuccessState] = useState<"idle" | "saved" | "deleted">("idle");
  const hydratedUnitRowsForEntry = useRef<string | null>(null);
  const workEntrySchema = useMemo(
    () => createWorkEntrySchema((key) => t(`entries:${key}`)),
    [t]
  );

  const form = useForm<WorkEntryFormInput, undefined, WorkEntryFormValues>({
    resolver: zodResolver(workEntrySchema),
    defaultValues: {
      workDate: formatLocalIsoDate(selectedDate),
      workTypeId: "",
      startTime: "09:00",
      endTime: "17:00",
      unpaidBreakMinutes: 30,
      notes: "",
      unitItems: []
    }
  });
  const { fields: unitItemFields, replace: replaceUnitItems } = useFieldArray({
    control: form.control,
    name: "unitItems"
  });

  const workTypesQuery = useQuery({
    queryKey: queryKeys.workTypes.all(),
    queryFn: listWorkTypes
  });
  const hourlyRatesQuery = useQuery({
    queryKey: queryKeys.hourlyRates.all(),
    queryFn: listHourlyRates
  });
  const entryQuery = useQuery({
    queryKey: queryKeys.workEntries.detail(entryId!),
    queryFn: () => getWorkEntry(entryId!),
    enabled: isEditing
  });

  const selectedWorkTypeId = form.watch("workTypeId");
  const selectedWorkType = useMemo(
    () => workTypesQuery.data?.find((item) => item.id === selectedWorkTypeId) ?? null,
    [selectedWorkTypeId, workTypesQuery.data]
  );

  const unitTypesQuery = useQuery({
    queryKey: queryKeys.unitTypes.list(selectedWorkTypeId),
    queryFn: () => listUnitTypes(selectedWorkTypeId),
    enabled: Boolean(selectedWorkTypeId && workTypeIsUnitBased(selectedWorkType))
  });
  const activeUnitTypes = useMemo(
    () =>
      (unitTypesQuery.data ?? [])
        .filter((unitType) => unitType.active)
        .sort((left, right) => left.displayOrder - right.displayOrder || left.name.localeCompare(right.name)),
    [unitTypesQuery.data]
  );

  useEffect(() => {
    if (!entryQuery.data) {
      return;
    }

    form.reset({
      workDate: entryQuery.data.workDate,
      workTypeId: entryQuery.data.workTypeId,
      startTime: entryQuery.data.timeEntry?.startTime ?? "",
      endTime: entryQuery.data.timeEntry?.endTime ?? "",
      unpaidBreakMinutes: entryQuery.data.timeEntry?.breakMinutes ?? 0,
      notes: entryQuery.data.notes ?? "",
      unitItems:
        entryQuery.data.unitItems.length > 0
          ? entryQuery.data.unitItems.map((item) => ({
              unitTypeId: item.unitTypeId,
              quantity: Number(item.quantity)
            }))
          : []
    });
  }, [entryQuery.data, form]);

  useEffect(() => {
    if (!selectedWorkType) {
      return;
    }

    if (workTypeIsTimeBased(selectedWorkType) && !isEditing) {
      form.setValue("unpaidBreakMinutes", selectedWorkType.defaultBreakMinutes ?? 0);
    }

    if (workTypeIsTimeBased(selectedWorkType)) {
      replaceUnitItems([]);
      return;
    }

    if (workTypeIsUnitBased(selectedWorkType)) {
      if (!activeUnitTypes.length) {
        return;
      }

      const hydrationKey = `${entryQuery.data?.id ?? "new"}:${selectedWorkType.id}`;
      const entryData = entryQuery.data;
      const shouldHydrateFromEntry =
        isEditing &&
        hydratedUnitRowsForEntry.current !== hydrationKey &&
        entryData?.workTypeId === selectedWorkType.id;
      const sourceRows = shouldHydrateFromEntry
          ? entryData.unitItems.map((item) => ({
              unitTypeId: item.unitTypeId,
              quantity: Number(item.quantity)
            }))
          : form.getValues("unitItems") ?? [];

      replaceUnitItems(buildUnitRows(activeUnitTypes, sourceRows));
      if (shouldHydrateFromEntry) {
        hydratedUnitRowsForEntry.current = hydrationKey;
      }
    }
  }, [activeUnitTypes, entryQuery.data, form, isEditing, replaceUnitItems, selectedWorkType]);

  const createMutation = useMutation({
    mutationFn: createWorkEntry,
    onSuccess: async () => {
      await afterSuccessfulMutation("saved");
    }
  });
  const updateMutation = useMutation({
    mutationFn: (values: WorkEntryFormValues) =>
      updateWorkEntry(entryId!, buildWorkEntryPayload(values, selectedWorkType)),
    onSuccess: async () => {
      await afterSuccessfulMutation("saved");
    }
  });
  const deleteMutation = useMutation({
    mutationFn: () => deleteWorkEntry(entryId!),
    onSuccess: async () => {
      await afterSuccessfulMutation("deleted");
    }
  });

  async function afterSuccessfulMutation(state: "saved" | "deleted") {
    setSuccessState(state);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.workEntries.all() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.absences.all() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.workTypes.all() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.unitTypes.all() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.hourlyRates.all() }),
      entryId
        ? queryClient.invalidateQueries({ queryKey: queryKeys.workEntries.detail(entryId) })
        : Promise.resolve()
    ]);
    window.setTimeout(() => {
      navigate(returnTo, { replace: true });
    }, 520);
  }

  const values = form.watch();
  const applicableRate = useMemo(
    () =>
      findApplicableHourlyRate(hourlyRatesQuery.data ?? [], values.workDate) ??
      hourlyRatesQuery.data?.[0] ??
      null,
    [hourlyRatesQuery.data, values.workDate]
  );

  const workedMinutes = useMemo(() => {
    if (!selectedWorkType) {
      return null;
    }

    if (workTypeIsTimeBased(selectedWorkType)) {
      return (
        calculateTimeEntryMinutes({
          startTime: values.startTime ?? "",
          endTime: values.endTime ?? "",
          breakMinutes: values.unpaidBreakMinutes ?? 0
        })?.workedMinutes ?? null
      );
    }

    return calculateUnitEntryMinutes(toUnitCalculationRows(values.unitItems), activeUnitTypes);
  }, [
    activeUnitTypes,
    selectedWorkType,
    values.endTime,
    values.startTime,
    values.unitItems,
    values.unpaidBreakMinutes
  ]);

  const grossAmount = useMemo(
    () => calculateGrossAmount(workedMinutes ?? 0, applicableRate?.hourlyRate ?? 0),
    [applicableRate?.hourlyRate, workedMinutes]
  );

  const isLoading =
    workTypesQuery.isLoading ||
    hourlyRatesQuery.isLoading ||
    entryQuery.isLoading ||
    unitTypesQuery.isLoading;
  const loadingError =
    workTypesQuery.error ??
    hourlyRatesQuery.error ??
    entryQuery.error ??
    unitTypesQuery.error;

  if (isLoading) {
    return (
      <ScreenMessage
        title={isEditing ? t("entries:editor.loadingEdit") : t("entries:editor.loadingCreate")}
        description={t("entries:editor.loadingDescription")}
      />
    );
  }

  if (loadingError) {
    return (
      <ScreenMessage
        title={t("entries:editor.unavailableTitle")}
        description={getApiError(loadingError).message}
      />
    );
  }

  if (!workTypesQuery.data?.length) {
    return (
      <ScreenMessage
        title={t("entries:editor.noWorkTypesTitle")}
        description={t("entries:editor.noWorkTypesDescription")}
      />
    );
  }

  return (
    <div className="space-y-6 pb-6">
      <header className="flex items-center justify-between">
        <Button variant="ghost" className="px-0" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("common:actions.back")}
        </Button>
        {isEditing ? (
          <Button
            variant="ghost"
            className="px-0 text-red-300 hover:text-red-200"
            onClick={() => setShowDeleteConfirm((value) => !value)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {t("common:actions.delete")}
          </Button>
        ) : (
          <span className="text-sm text-white/46">{t("entries:editor.newEntry")}</span>
        )}
      </header>

      <div className="space-y-3">
        <p className="hairline-text">{t("entries:editor.eyebrow")}</p>
        <h1 className="text-[2.4rem] font-semibold tracking-[-0.08em] text-white">
          {isEditing ? t("entries:editor.editTitle") : t("entries:editor.createTitle")}
        </h1>
        <p className="max-w-md text-sm leading-6 text-white/56">
          {t("entries:editor.description")}
        </p>
      </div>

      <AnimatePresence>
        {showDeleteConfirm ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="surface-muted border-red-300/16 bg-red-400/8 p-4"
          >
            <p className="text-base font-semibold text-white">{t("entries:delete.title")}</p>
            <p className="mt-2 text-sm leading-6 text-white/62">
              {t("entries:delete.description")}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Button variant="secondary" className="w-full" onClick={() => setShowDeleteConfirm(false)}>
                {t("entries:delete.keep")}
              </Button>
              <Button
                className="w-full bg-red-300 text-black hover:bg-red-200"
                onClick={() => void deleteMutation.mutateAsync()}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? t("entries:delete.deleting") : t("common:actions.delete")}
              </Button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <form
        className="space-y-5"
        onSubmit={form.handleSubmit(async (nextValues) => {
          if (!selectedWorkType) {
            return;
          }
          form.clearErrors("root");

          if (
            !validateSelectedWorkTypeForm(
              nextValues,
              selectedWorkType,
              activeUnitTypes,
              form.setError,
              {
                timeRequired: t("entries:validation.timeRequired"),
                invalidTimeRange: t("entries:validation.invalidTimeRange"),
                configureUnitTypes: t("entries:validation.configureUnitTypes"),
                positiveUnitQuantity: t("entries:validation.positiveUnitQuantity")
              }
            )
          ) {
            return;
          }

          try {
            if (isEditing) {
              await updateMutation.mutateAsync(nextValues);
              return;
            }

            await createMutation.mutateAsync(
              buildWorkEntryPayload(nextValues, selectedWorkType)
            );
          } catch {
            // Mutation state keeps the API error visible and preserves entered values.
          }
        })}
      >
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.04]">
              <CalendarDays className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="hairline-text">{t("entries:editor.step1")}</p>
              <h2 className="text-lg font-semibold tracking-[-0.04em] text-white">{t("entries:editor.chooseDate")}</h2>
            </div>
          </div>
          <Input
            label={t("entries:fields.workDate")}
            type="date"
            error={form.formState.errors.workDate?.message}
            {...form.register("workDate")}
          />
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.04]">
              <Clock3 className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="hairline-text">{t("entries:editor.step2")}</p>
              <h2 className="text-lg font-semibold tracking-[-0.04em] text-white">{t("entries:editor.chooseWorkType")}</h2>
            </div>
          </div>
          <WorkTypePicker
            selectedId={selectedWorkTypeId}
            workTypes={workTypesQuery.data}
            onChange={(workTypeId) => form.setValue("workTypeId", workTypeId, { shouldValidate: true })}
          />
          {form.formState.errors.workTypeId?.message ? (
            <p className="text-sm text-red-300">{form.formState.errors.workTypeId.message}</p>
          ) : null}
        </section>

        {selectedWorkType && workTypeIsTimeBased(selectedWorkType) ? (
          <section className="space-y-4">
            <div>
              <p className="hairline-text">{t("entries:workTypePicker.timeBased")}</p>
              <h2 className="mt-2 text-lg font-semibold tracking-[-0.04em] text-white">{t("entries:editor.shiftDetails")}</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label={t("entries:fields.startTime")}
                type="time"
                error={form.formState.errors.startTime?.message}
                {...form.register("startTime")}
              />
              <Input
                label={t("entries:fields.endTime")}
                type="time"
                error={form.formState.errors.endTime?.message}
                {...form.register("endTime")}
              />
            </div>
            <Input
              label={t("entries:fields.breakMinutes")}
              type="number"
              min={0}
              error={form.formState.errors.unpaidBreakMinutes?.message}
              {...form.register("unpaidBreakMinutes", { valueAsNumber: true })}
            />
            <p className="text-sm text-white/46">
              {t("entries:editor.overnightHint")}
            </p>
          </section>
        ) : null}

        {selectedWorkType && workTypeIsUnitBased(selectedWorkType) ? (
          <section className="space-y-4">
            <div>
              <p className="hairline-text">{t("entries:workTypePicker.unitBased")}</p>
              <h2 className="mt-2 text-lg font-semibold tracking-[-0.04em] text-white">{t("entries:editor.countUnits")}</h2>
            </div>
            {activeUnitTypes.length ? (
              <>
                <p className="text-sm leading-6 text-white/52">
                  {t("entries:editor.unitQuantityHint")}
                </p>
                <UnitItemRows
                  fields={unitItemFields}
                  unitTypes={activeUnitTypes}
                  register={form.register}
                  unitFallbackLabel={t("entries:unitRows.fallbackUnit")}
                  quantityLabel={t("entries:unitRows.quantity")}
                  perHourLabel={t("entries:unitRows.perHour")}
                  errors={form.formState.errors.unitItems as Array<
                    { unitTypeId?: { message?: string }; quantity?: { message?: string } } | undefined
                  >}
                />
              </>
            ) : (
              <div className="surface-muted space-y-4 p-5">
                <div>
                  <p className="text-base font-semibold tracking-[-0.03em] text-white">
                    {t("entries:editor.noUnitTypesTitle")}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-white/52">
                    {t("entries:editor.noUnitTypesDescription")}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  onClick={() => navigate(`/settings/work-types/${selectedWorkType.id}`)}
                >
                  {t("entries:editor.configureUnits")}
                </Button>
              </div>
            )}
          </section>
        ) : null}

        <section className="space-y-4">
          <Textarea
            label={t("entries:fields.notes")}
            placeholder={t("entries:fields.notesPlaceholder")}
            error={form.formState.errors.notes?.message}
            {...form.register("notes")}
          />
        </section>

        <WorkEntrySummaryCard
          workTypeName={selectedWorkType?.name ?? t("entries:validation.chooseWorkType")}
          workDate={values.workDate}
          hourlyRate={applicableRate?.hourlyRate ?? "0"}
          currency={applicableRate?.currency ?? "EUR"}
          workedMinutes={workedMinutes}
          grossAmount={grossAmount}
        />

        {form.formState.errors.root?.message ? (
          <p className="text-sm text-red-300">{form.formState.errors.root.message}</p>
        ) : null}
        {createMutation.error || updateMutation.error ? (
          <p className="text-sm text-red-300">
            {getApiError(createMutation.error ?? updateMutation.error).message}
          </p>
        ) : null}

        <Button
          className="w-full"
          type="submit"
          disabled={
            createMutation.isPending ||
            updateMutation.isPending ||
            successState !== "idle" ||
            (Boolean(selectedWorkType) && workTypeIsUnitBased(selectedWorkType) && activeUnitTypes.length === 0)
          }
        >
          {createMutation.isPending || updateMutation.isPending
            ? t("entries:editor.saving")
            : successState === "saved"
              ? t("entries:saved")
              : t("entries:editor.save")}
        </Button>
      </form>

      <AnimatePresence>
        {successState !== "idle" ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="glass-panel fixed inset-x-6 top-24 z-[70] mx-auto max-w-sm rounded-[28px] px-5 py-4 text-center"
          >
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-black">
              <Check className="h-6 w-6" />
            </div>
            <p className="mt-3 text-base font-semibold text-white">
              {successState === "saved" ? t("entries:editor.savedToast") : t("entries:editor.deletedToast")}
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function buildWorkEntryPayload(
  values: WorkEntryFormValues,
  workType: WorkType | null
) {
  if (!workType) {
    throw new Error("Work type is required");
  }

  const payload = {
    workTypeId: values.workTypeId,
    workDate: values.workDate,
    notes: emptyToNull(values.notes)
  };

  if (workTypeIsTimeBased(workType)) {
    return {
      ...payload,
      startTime: values.startTime || null,
      endTime: values.endTime || null,
      unpaidBreakMinutes: values.unpaidBreakMinutes ?? 0
    };
  }

  return {
    ...payload,
    unitItems: toPositiveUnitPayloadRows(values.unitItems)
  };
}

function emptyToNull(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function buildUnitRows(
  unitTypes: UnitType[],
  currentRows: RawUnitRow[]
) {
  return unitTypes.map((unitType) => {
    const current = currentRows.find((row) => row.unitTypeId === unitType.id);
    const quantity = Number(current?.quantity ?? 0);
    return {
      unitTypeId: unitType.id,
      quantity: Number.isFinite(quantity) ? quantity : 0
    };
  });
}

function toUnitCalculationRows(rows?: RawUnitRow[]) {
  return (rows ?? []).flatMap((row) => {
    const quantity = Number(row.quantity);
    if (!row.unitTypeId || !Number.isFinite(quantity)) {
      return [];
    }
    return [{ unitTypeId: row.unitTypeId, quantity }];
  });
}

function toPositiveUnitPayloadRows(rows?: RawUnitRow[]) {
  return toUnitCalculationRows(rows).filter((row) => row.quantity > 0);
}

function validateSelectedWorkTypeForm(
  values: WorkEntryFormValues,
  workType: WorkType,
  activeUnitTypes: UnitType[],
  setError: UseFormSetError<WorkEntryFormInput>,
  messages: {
    timeRequired: string;
    invalidTimeRange: string;
    configureUnitTypes: string;
    positiveUnitQuantity: string;
  }
) {
  if (workTypeIsTimeBased(workType)) {
    if (!values.startTime || !values.endTime) {
      setError("root", { message: messages.timeRequired });
      return false;
    }

    const calculation = calculateTimeEntryMinutes({
      startTime: values.startTime,
      endTime: values.endTime,
      breakMinutes: values.unpaidBreakMinutes ?? 0
    });

    if (!calculation) {
      setError("root", { message: messages.invalidTimeRange });
      return false;
    }

    return true;
  }

  if (!activeUnitTypes.length) {
    setError("root", { message: messages.configureUnitTypes });
    return false;
  }

  const hasPositiveQuantity = (values.unitItems ?? []).some((item) => Number(item.quantity) > 0);
  if (!hasPositiveQuantity) {
    setError("root", { message: messages.positiveUnitQuantity });
    return false;
  }

  return true;
}

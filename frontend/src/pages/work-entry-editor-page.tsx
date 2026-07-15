import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm, useWatch, type UseFormSetError } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Trash2 } from "lucide-react";
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
import { WorkTypePicker } from "../components/work-entry/work-type-picker";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { ScreenMessage } from "../components/ui/screen-message";
import { Textarea } from "../components/ui/textarea";
import { useUnsavedChangesGuard } from "../hooks/use-unsaved-changes-guard";
import { formatLocalIsoDate } from "../utils/date";
import { parseDecimalInput } from "../utils/decimal-input";
import {
  calculateTimeEntryMinutes,
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

const DEFAULT_SHIFT_INTERVAL_MINUTES = 8 * 60 + 30;

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
  const endTimeEditedByUser = useRef(false);
  const workEntrySchema = useMemo(
    () => createWorkEntrySchema((key) => t(`entries:${key}`)),
    [t]
  );

  const form = useForm<WorkEntryFormInput, undefined, WorkEntryFormValues>({
    resolver: zodResolver(workEntrySchema),
    defaultValues: {
      workDate: formatLocalIsoDate(selectedDate),
      workTypeId: "",
      startTime: "08:00",
      endTime: "16:30",
      unpaidBreakMinutes: 30,
      extraPayPercentage: 0,
      notes: "",
      unitItems: []
    }
  });
  const { fields: unitItemFields, replace: replaceUnitItems } = useFieldArray({
    control: form.control,
    name: "unitItems"
  });
  const watchedStartTime = useWatch({ control: form.control, name: "startTime" });

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

    endTimeEditedByUser.current = true;
	    form.reset({
	      workDate: entryQuery.data.workDate,
	      workTypeId: entryQuery.data.workTypeId,
	      startTime: toTimeInputValue(entryQuery.data.timeEntry?.startTime),
	      endTime: toTimeInputValue(entryQuery.data.timeEntry?.endTime),
	      unpaidBreakMinutes: entryQuery.data.timeEntry?.breakMinutes ?? 0,
	      extraPayPercentage: entryQuery.data.extraPayPercentage ?? 0,
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
    if (isEditing || endTimeEditedByUser.current) {
      return;
    }

    const nextEndTime = addMinutesToTime(watchedStartTime, DEFAULT_SHIFT_INTERVAL_MINUTES);
    if (!nextEndTime) {
      return;
    }

    if (form.getValues("endTime") === nextEndTime) {
      return;
    }

    form.setValue("endTime", nextEndTime, {
      shouldDirty: true,
      shouldValidate: false
    });
  }, [form, isEditing, watchedStartTime]);

  useEffect(() => {
    if (!selectedWorkType) {
      return;
    }

    if (workTypeIsTimeBased(selectedWorkType) && !isEditing) {
      form.setValue(
        "unpaidBreakMinutes",
        selectedWorkType.defaultBreakMinutes && selectedWorkType.defaultBreakMinutes > 0
          ? selectedWorkType.defaultBreakMinutes
          : 30
      );
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
    form.reset(form.getValues());
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.workEntries.all() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.absences.all() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.workTypes.all() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.unitTypes.all() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.hourlyRates.all() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.statistics.all() }),
      entryId
        ? queryClient.invalidateQueries({ queryKey: queryKeys.workEntries.detail(entryId) })
        : Promise.resolve()
    ]);
    window.setTimeout(() => {
      navigate(returnTo, { replace: true });
    }, 520);
  }

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
  const { dialog } = useUnsavedChangesGuard({
    isDirty:
      form.formState.isDirty &&
      successState === "idle" &&
      !createMutation.isPending &&
      !updateMutation.isPending &&
      !deleteMutation.isPending
  });

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

  const saveApiError =
    createMutation.error || updateMutation.error
      ? getApiError(createMutation.error ?? updateMutation.error)
      : null;
  const timeOverlapError =
    saveApiError?.code === "WORK_ENTRY_TIME_OVERLAP" ? saveApiError.message : null;
  const generalSaveError =
    saveApiError && saveApiError.code !== "WORK_ENTRY_TIME_OVERLAP" ? saveApiError.message : null;

  return (
    <div className="min-w-0 max-w-full overflow-x-clip space-y-6 pb-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-[2rem] font-semibold tracking-[-0.07em] text-white">
          {isEditing ? t("entries:editor.editActivity") : t("entries:editor.newActivity")}
        </h1>
        {isEditing ? (
          <Button
            variant="ghost"
            className="px-0 text-red-300 hover:text-red-200"
            onClick={() => setShowDeleteConfirm((value) => !value)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {t("common:actions.delete")}
          </Button>
        ) : null}
      </header>

      <div className="space-y-3">
        <p className="hairline-text">{t("entries:editor.eyebrow")}</p>
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
        <section>
          <div className="mx-auto w-full max-w-[15rem]">
            <input
              type="date"
              aria-label={t("entries:fields.workDate")}
              className="h-12 w-full appearance-none rounded-full border border-white/[0.12] bg-white/[0.06] px-4 text-center text-[0.95rem] font-semibold text-white outline-none transition focus:border-white/[0.28] focus:bg-white/[0.09] focus:ring-2 focus:ring-white/24"
              {...form.register("workDate")}
            />
            {form.formState.errors.workDate?.message ? (
              <p className="mt-2 text-center text-xs text-red-300">
                {form.formState.errors.workDate.message}
              </p>
            ) : null}
          </div>
        </section>

        <section className="space-y-3">
          <p className="hairline-text">
            {t("entries:editor.workTypeQuestion")}
          </p>
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
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-2">
                <span className="block text-sm font-medium text-white/78">{t("entries:fields.startTime")}</span>
                <input
                  type="time"
                  aria-label={t("entries:fields.startTime")}
                  className="h-12 w-full appearance-none rounded-full border border-white/[0.12] bg-white/[0.06] px-3 text-center text-[0.95rem] font-semibold text-white outline-none transition focus:border-white/[0.28] focus:bg-white/[0.09] focus:ring-2 focus:ring-white/24"
                  {...form.register("startTime")}
                />
                {form.formState.errors.startTime?.message ? (
                  <p className="text-xs text-red-300">{form.formState.errors.startTime.message}</p>
                ) : null}
              </label>
              <label className="space-y-2">
                <span className="block text-sm font-medium text-white/78">{t("entries:fields.endTime")}</span>
                <input
                  type="time"
                  aria-label={t("entries:fields.endTime")}
                  className="h-12 w-full appearance-none rounded-full border border-white/[0.12] bg-white/[0.06] px-3 text-center text-[0.95rem] font-semibold text-white outline-none transition focus:border-white/[0.28] focus:bg-white/[0.09] focus:ring-2 focus:ring-white/24"
                  onFocus={() => {
                    endTimeEditedByUser.current = true;
                  }}
                  {...form.register("endTime")}
                />
                {form.formState.errors.endTime?.message ? (
                  <p className="text-xs text-red-300">{form.formState.errors.endTime.message}</p>
                ) : null}
              </label>
            </div>
            <Input
              label={t("entries:fields.breakMinutes")}
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              min={0}
              error={form.formState.errors.unpaidBreakMinutes?.message}
              {...form.register("unpaidBreakMinutes", { valueAsNumber: true })}
              onFocus={(event) => {
                if (event.currentTarget.value === "30") {
                  event.currentTarget.value = "";
                  form.setValue("unpaidBreakMinutes", Number.NaN, {
                    shouldDirty: true,
                    shouldValidate: false
                  });
                }
              }}
            />
            {timeOverlapError ? (
              <p className="text-sm text-red-300">{timeOverlapError}</p>
            ) : null}
          </section>
        ) : null}

        {selectedWorkType && workTypeIsUnitBased(selectedWorkType) ? (
          <section className="space-y-4">
            <div>
              <p className="hairline-text">{t("entries:workTypePicker.unitBased")}</p>
            </div>
            {activeUnitTypes.length ? (
              <>
                <UnitItemRows
                  fields={unitItemFields}
                  unitTypes={activeUnitTypes}
                  register={form.register}
                  unitFallbackLabel={t("entries:unitRows.fallbackUnit")}
                  quantityLabel={t("entries:unitRows.quantity")}
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

        {selectedWorkType ? (
          <section>
            <Input
              label={t("entries:fields.extraPay")}
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              min={0}
              max={1000}
              error={form.formState.errors.extraPayPercentage?.message}
              {...form.register("extraPayPercentage", { valueAsNumber: true })}
              onFocus={(event) => {
                if (event.currentTarget.value === "0") {
                  event.currentTarget.value = "";
                  form.setValue("extraPayPercentage", Number.NaN, {
                    shouldDirty: true,
                    shouldValidate: false
                  });
                }
              }}
              onBlur={(event) => {
                if (!event.currentTarget.value) {
                  form.setValue("extraPayPercentage", 0, {
                    shouldDirty: true,
                    shouldValidate: false
                  });
                }
              }}
            />
          </section>
        ) : null}

        <section className="space-y-4">
          <Textarea
            label={t("entries:fields.notes")}
            labelClassName="hairline-text"
            placeholder={t("entries:fields.notesPlaceholder")}
            error={form.formState.errors.notes?.message}
            {...form.register("notes")}
          />
        </section>

        {form.formState.errors.root?.message ? (
          <p className="text-sm text-red-300">{form.formState.errors.root.message}</p>
        ) : null}
        {generalSaveError ? (
          <p className="text-sm text-red-300">{generalSaveError}</p>
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
      {dialog}
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
  const extraPayPercentage = Number.isFinite(values.extraPayPercentage)
    ? values.extraPayPercentage ?? 0
    : 0;

  if (workTypeIsTimeBased(workType)) {
    return {
      ...payload,
      extraPayPercentage,
      startTime: values.startTime || null,
      endTime: values.endTime || null,
      unpaidBreakMinutes: values.unpaidBreakMinutes ?? 0
    };
  }

  return {
    ...payload,
    extraPayPercentage,
    unitItems: toPositiveUnitPayloadRows(values.unitItems)
  };
}

function emptyToNull(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function addMinutesToTime(value: string | undefined, minutesToAdd: number) {
  const match = value?.match(/^(\d{2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) {
    return null;
  }

  const totalMinutes = (hours * 60 + minutes + minutesToAdd) % (24 * 60);
  const nextHours = Math.floor(totalMinutes / 60);
  const nextMinutes = totalMinutes % 60;

  return `${String(nextHours).padStart(2, "0")}:${String(nextMinutes).padStart(2, "0")}`;
}

function toTimeInputValue(value?: string | null) {
  const match = value?.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
  return match ? `${match[1]}:${match[2]}` : "";
}

function buildUnitRows(
  unitTypes: UnitType[],
  currentRows: RawUnitRow[]
) {
  return unitTypes.map((unitType) => {
    const current = currentRows.find((row) => row.unitTypeId === unitType.id);
    const quantity = parseDecimalInput(current?.quantity ?? 0);
    return {
      unitTypeId: unitType.id,
      quantity: Number.isFinite(quantity) ? quantity : 0
    };
  });
}

function toUnitCalculationRows(rows?: RawUnitRow[]) {
  return (rows ?? []).flatMap((row) => {
    const quantity = parseDecimalInput(row.quantity);
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

  const hasPositiveQuantity = (values.unitItems ?? []).some((item) => parseDecimalInput(item.quantity) > 0);
  if (!hasPositiveQuantity) {
    setError("root", { message: messages.positiveUnitQuantity });
    return false;
  }

  return true;
}

import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, CalendarDays, Check, Clock3, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
  workEntrySchema,
  type WorkEntryFormInput,
  type WorkEntryFormValues
} from "../features/work-entries/work-entry-schemas";
import type { WorkType } from "../types/configuration";

type OutletContext = {
  selectedDate?: Date;
};

export function WorkEntryEditorPage() {
  const navigate = useNavigate();
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

  const form = useForm<WorkEntryFormInput, undefined, WorkEntryFormValues>({
    resolver: zodResolver(workEntrySchema),
    defaultValues: {
      workDate: formatLocalIsoDate(selectedDate),
      workTypeId: "",
      startTime: "09:00",
      endTime: "17:00",
      unpaidBreakMinutes: 30,
      notes: "",
      unitItems: [{ unitTypeId: "", quantity: 1 }]
    }
  });
  const unitItemsFieldArray = useFieldArray({
    control: form.control,
    name: "unitItems"
  });

  const workTypesQuery = useQuery({
    queryKey: ["work-types"],
    queryFn: listWorkTypes
  });
  const hourlyRatesQuery = useQuery({
    queryKey: ["hourly-rates"],
    queryFn: listHourlyRates
  });
  const entryQuery = useQuery({
    queryKey: ["work-entry", entryId],
    queryFn: () => getWorkEntry(entryId!),
    enabled: isEditing
  });

  const selectedWorkTypeId = form.watch("workTypeId");
  const selectedWorkType = useMemo(
    () => workTypesQuery.data?.find((item) => item.id === selectedWorkTypeId) ?? null,
    [selectedWorkTypeId, workTypesQuery.data]
  );

  const unitTypesQuery = useQuery({
    queryKey: ["unit-types", selectedWorkTypeId],
    queryFn: () => listUnitTypes(selectedWorkTypeId),
    enabled: Boolean(selectedWorkTypeId && workTypeIsUnitBased(selectedWorkType))
  });

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
          : [{ unitTypeId: "", quantity: 1 }]
    });
  }, [entryQuery.data, form]);

  useEffect(() => {
    if (!selectedWorkType) {
      return;
    }

    if (workTypeIsTimeBased(selectedWorkType) && !isEditing) {
      form.setValue("unpaidBreakMinutes", selectedWorkType.defaultBreakMinutes ?? 0);
    }

    if (
      workTypeIsUnitBased(selectedWorkType) &&
      (form.getValues("unitItems")?.length ?? 0) === 0
    ) {
      unitItemsFieldArray.append({ unitTypeId: "", quantity: 1 });
    }
  }, [form, isEditing, selectedWorkType, unitItemsFieldArray]);

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
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["work-entries"] }),
      queryClient.invalidateQueries({ queryKey: ["absences"] }),
      queryClient.invalidateQueries({ queryKey: ["work-entry", entryId] })
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

    return calculateUnitEntryMinutes(values.unitItems ?? [], unitTypesQuery.data ?? []);
  }, [
    selectedWorkType,
    unitTypesQuery.data,
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
        title={isEditing ? "Loading entry..." : "Preparing quick add..."}
        description="Bringing in work types, rates and the entry surface."
      />
    );
  }

  if (loadingError) {
    return (
      <ScreenMessage
        title="Work entry is unavailable"
        description={getApiError(loadingError).message}
      />
    );
  }

  if (!workTypesQuery.data?.length) {
    return (
      <ScreenMessage
        title="No active work types yet"
        description="Finish onboarding or add a work type before creating entries."
      />
    );
  }

  return (
    <div className="space-y-6 pb-6">
      <header className="flex items-center justify-between">
        <Button variant="ghost" className="px-0" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        {isEditing ? (
          <Button
            variant="ghost"
            className="px-0 text-red-300 hover:text-red-200"
            onClick={() => setShowDeleteConfirm((value) => !value)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        ) : (
          <span className="text-sm text-white/46">New entry</span>
        )}
      </header>

      <div className="space-y-3">
        <p className="hairline-text">Work Entry</p>
        <h1 className="text-[2.4rem] font-semibold tracking-[-0.08em] text-white">
          {isEditing ? "Edit this entry." : "Capture work in one motion."}
        </h1>
        <p className="max-w-md text-sm leading-6 text-white/56">
          Fast, calm, and adapted to the work type you choose.
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
            <p className="text-base font-semibold text-white">Delete this entry?</p>
            <p className="mt-2 text-sm leading-6 text-white/62">
              This removes the entry and returns you to the dashboard.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Button variant="secondary" className="w-full" onClick={() => setShowDeleteConfirm(false)}>
                Keep entry
              </Button>
              <Button
                className="w-full bg-red-300 text-black hover:bg-red-200"
                onClick={() => void deleteMutation.mutateAsync()}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
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

          if (isEditing) {
            await updateMutation.mutateAsync(nextValues);
            return;
          }

          await createMutation.mutateAsync(
            buildWorkEntryPayload(nextValues, selectedWorkType)
          );
        })}
      >
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.04]">
              <CalendarDays className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="hairline-text">Step 1</p>
              <h2 className="text-lg font-semibold tracking-[-0.04em] text-white">Choose date</h2>
            </div>
          </div>
          <Input
            label="Work date"
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
              <p className="hairline-text">Step 2</p>
              <h2 className="text-lg font-semibold tracking-[-0.04em] text-white">Choose work type</h2>
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
              <p className="hairline-text">Time Based</p>
              <h2 className="mt-2 text-lg font-semibold tracking-[-0.04em] text-white">Shift details</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Start time"
                type="time"
                error={form.formState.errors.startTime?.message}
                {...form.register("startTime")}
              />
              <Input
                label="End time"
                type="time"
                error={form.formState.errors.endTime?.message}
                {...form.register("endTime")}
              />
            </div>
            <Input
              label="Break (minutes)"
              type="number"
              min={0}
              error={form.formState.errors.unpaidBreakMinutes?.message}
              {...form.register("unpaidBreakMinutes", { valueAsNumber: true })}
            />
            <p className="text-sm text-white/46">
              Overnight shifts are supported automatically.
            </p>
          </section>
        ) : null}

        {selectedWorkType && workTypeIsUnitBased(selectedWorkType) ? (
          <section className="space-y-4">
            <div>
              <p className="hairline-text">Unit Based</p>
              <h2 className="mt-2 text-lg font-semibold tracking-[-0.04em] text-white">Add unit rows</h2>
            </div>
            <UnitItemRows
              fields={unitItemsFieldArray.fields}
              unitTypes={unitTypesQuery.data ?? []}
              register={form.register}
              append={unitItemsFieldArray.append}
              remove={unitItemsFieldArray.remove}
              errors={form.formState.errors.unitItems as Array<
                { unitTypeId?: { message?: string }; quantity?: { message?: string } } | undefined
              >}
            />
          </section>
        ) : null}

        <section className="space-y-4">
          <Textarea
            label="Notes (optional)"
            placeholder="Anything useful about the shift, route or context."
            error={form.formState.errors.notes?.message}
            {...form.register("notes")}
          />
        </section>

        <WorkEntrySummaryCard
          workTypeName={selectedWorkType?.name ?? "Choose a work type"}
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
          disabled={createMutation.isPending || updateMutation.isPending || successState !== "idle"}
        >
          {createMutation.isPending || updateMutation.isPending
            ? "Saving entry..."
            : successState === "saved"
              ? "Saved"
              : "Save Entry"}
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
              {successState === "saved" ? "Entry saved" : "Entry deleted"}
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
    unitItems: (values.unitItems ?? [])
      .filter((item) => item.unitTypeId && Number(item.quantity) > 0)
      .map((item) => ({
        unitTypeId: item.unitTypeId,
        quantity: Number(item.quantity)
      }))
  };
}

function emptyToNull(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Clock3 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { getApiError } from "../api/api-errors";
import { queryKeys } from "../api/query-keys";
import {
  createUnitType,
  createWorkType,
  deleteUnitType,
  deleteWorkType,
  getWorkType,
  listUnitTypes,
  updateUnitType,
  updateWorkType
} from "../api/endpoints";
import { SettingsConfirmDialog } from "../components/settings/settings-confirm-dialog";
import { SettingsEmptyState } from "../components/settings/settings-empty-state";
import { SettingsFormActions } from "../components/settings/settings-form-actions";
import { SettingsPageHeader } from "../components/settings/settings-page-header";
import { SettingsPageSkeleton } from "../components/settings/settings-page-skeleton";
import { SettingsSection } from "../components/settings/settings-section";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { ScreenMessage } from "../components/ui/screen-message";
import { Select } from "../components/ui/select";
import { useSafeBackNavigation } from "../hooks/use-safe-back-navigation";
import { useUnsavedChangesGuard } from "../hooks/use-unsaved-changes-guard";
import type { UnitType } from "../types/configuration";

const WORK_TYPE_COLORS = [
  "#FFFFFF",
  "#A3E635",
  "#34D399",
  "#60A5FA",
  "#FBBF24",
  "#FB7185"
] as const;

function createWorkTypeSchema(t: (key: string) => string) {
  return z.object({
    name: z.string()
      .trim()
      .transform((value) => value.toLocaleUpperCase())
      .pipe(z.string().min(1, t("workTypeEditor.validation.nameRequired")).max(100, t("workTypeEditor.validation.nameTooLong"))),
    calculationMethod: z.enum(["TIME_BASED", "UNIT_BASED"]),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().default("#FFFFFF"),
    active: z.boolean().optional().default(true)
  });
}

function parseDecimalInput(value: unknown) {
  if (typeof value === "string") {
    const normalized = value.trim().replace(",", ".");
    return normalized === "" ? Number.NaN : Number(normalized);
  }
  return value;
}

function createUnitDialogSchema(t: (key: string) => string) {
  return z.object({
    name: z.string().trim().min(1, t("unitTypes.validation.nameRequired")).max(100, t("unitTypes.validation.nameTooLong")),
    unitsPerHour: z.preprocess(
      parseDecimalInput,
      z.number({ error: t("unitTypes.validation.unitsPerHour") }).gt(0, t("unitTypes.validation.unitsPerHour"))
    )
  });
}

type Schema = ReturnType<typeof createWorkTypeSchema>;
type FormValues = z.infer<Schema>;
type FormInput = z.input<Schema>;
type UnitDialogSchema = ReturnType<typeof createUnitDialogSchema>;
type UnitDialogValues = z.infer<UnitDialogSchema>;
type UnitDialogInput = z.input<UnitDialogSchema>;

export function WorkTypeEditorPage() {
  const navigate = useNavigate();
  const { t } = useTranslation(["settings", "common", "entries", "errors"]);
  const queryClient = useQueryClient();
  const { workTypeId } = useParams();
  const isEditing = Boolean(workTypeId);
  const [showConfirm, setShowConfirm] = useState(false);
  const [unitDialogOpen, setUnitDialogOpen] = useState(false);
  const [selectedUnitType, setSelectedUnitType] = useState<UnitType | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const safeBack = useSafeBackNavigation({ fallback: "/settings/work-types" });
  const schema = useMemo(() => createWorkTypeSchema((key) => t(`settings:${key}`)), [t]);
  const unitDialogSchema = useMemo(() => createUnitDialogSchema((key) => t(`settings:${key}`)), [t]);

  const workTypeQuery = useQuery({
    queryKey: workTypeId ? queryKeys.workTypes.detail(workTypeId) : queryKeys.workTypes.all(),
    queryFn: () => getWorkType(workTypeId!),
    enabled: isEditing
  });

  const unitTypesQuery = useQuery({
    queryKey: workTypeId ? queryKeys.unitTypes.list(workTypeId) : queryKeys.workTypes.all(),
    queryFn: () => listUnitTypes(workTypeId!),
    enabled: Boolean(workTypeId && workTypeQuery.data?.calculationMethod === "UNIT_BASED")
  });

  const form = useForm<FormInput, undefined, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      calculationMethod: "TIME_BASED",
      color: "#FFFFFF",
      active: true
    }
  });
  const unitForm = useForm<UnitDialogInput, undefined, UnitDialogValues>({
    resolver: zodResolver(unitDialogSchema),
    defaultValues: {
      name: "",
      unitsPerHour: ""
    }
  });

  useEffect(() => {
    if (!workTypeQuery.data) return;
    form.reset({
      name: workTypeQuery.data.name,
      calculationMethod: workTypeQuery.data.calculationMethod,
      color: workTypeQuery.data.color,
      active: workTypeQuery.data.active
    });
  }, [form, workTypeQuery.data]);

  async function afterSuccess(targetId?: string, calculationMethod?: FormValues["calculationMethod"]) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.workTypes.all() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.unitTypes.all() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.workEntries.all() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.statistics.all() })
    ]);
    if (targetId && (isEditing || calculationMethod === "UNIT_BASED")) {
      navigate(`/settings/work-types/${targetId}`, { replace: true });
      return;
    }
    navigate("/settings/work-types", { replace: true });
  }

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (isEditing) {
        return updateWorkType(workTypeId!, {
          name: values.name,
          calculationMethod: values.calculationMethod,
          color: values.color,
          icon: workTypeQuery.data?.icon ?? null,
          defaultBreakMinutes:
            values.calculationMethod === "TIME_BASED"
              ? workTypeQuery.data?.defaultBreakMinutes
              : null,
          displayOrder: workTypeQuery.data?.displayOrder ?? 0,
          active: workTypeQuery.data?.active ?? true
        });
      }

      return createWorkType({
        name: values.name,
        calculationMethod: values.calculationMethod
      });
    },
    onSuccess: async (workType) => {
      setSuccessMessage(isEditing ? t("settings:workTypeEditor.updated") : t("settings:workTypeEditor.created"));
      await afterSuccess(workType.id, workType.calculationMethod);
    },
    onError: (error) => {
      const apiError = getApiError(error);
      if (apiError.code === "WORK_TYPE_NAME_EXISTS") {
        form.setError("name", { message: t("errors:WORK_TYPE_NAME_EXISTS") });
        form.setError("root", { message: t("errors:WORK_TYPE_NAME_EXISTS") });
        return;
      }
      Object.entries(apiError.fieldErrors).forEach(([field, message]) => {
        form.setError(field as keyof FormValues, { message });
      });
      form.setError("root", {
        message: formatWorkTypeError(
          apiError.message,
          t("settings:workTypeEditor.savedEntriesError")
        )
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteWorkType(workTypeId!),
    onSuccess: async () => {
      setShowConfirm(false);
      await afterSuccess();
    }
  });

  const createUnitMutation = useMutation({
    mutationFn: (values: UnitDialogValues) =>
      createUnitType(workTypeId!, {
        name: values.name.trim(),
        unitsPerHour: values.unitsPerHour,
        active: true
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.unitTypes.list(workTypeId!) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.unitTypes.all() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.workTypes.all() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.workEntries.all() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.statistics.all() })
      ]);
      unitForm.reset({ name: "", unitsPerHour: "" });
      setUnitDialogOpen(false);
    },
    onError: (error) => {
      const apiError = getApiError(error);
      Object.entries(apiError.fieldErrors).forEach(([field, message]) => {
        unitForm.setError(field as keyof UnitDialogValues, { message });
      });
      unitForm.setError("root", { message: apiError.message });
    }
  });

  const updateUnitMutation = useMutation({
    mutationFn: ({ unitType, values }: { unitType: UnitType; values: UnitDialogValues }) =>
      updateUnitType(workTypeId!, unitType.id, {
        name: values.name.trim(),
        unitsPerHour: values.unitsPerHour,
        displayOrder: unitType.displayOrder,
        active: unitType.active
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.unitTypes.list(workTypeId!) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.unitTypes.all() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.workTypes.all() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.workEntries.all() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.statistics.all() })
      ]);
      unitForm.reset({ name: "", unitsPerHour: "" });
      setSelectedUnitType(null);
      setUnitDialogOpen(false);
    },
    onError: (error) => {
      const apiError = getApiError(error);
      Object.entries(apiError.fieldErrors).forEach(([field, message]) => {
        unitForm.setError(field as keyof UnitDialogValues, { message });
      });
      unitForm.setError("root", { message: apiError.message });
    }
  });

  const deleteUnitMutation = useMutation({
    mutationFn: (unitType: UnitType) => deleteUnitType(workTypeId!, unitType.id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.unitTypes.list(workTypeId!) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.unitTypes.all() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.workTypes.all() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.workEntries.all() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.statistics.all() })
      ]);
      unitForm.reset({ name: "", unitsPerHour: "" });
      setSelectedUnitType(null);
      setUnitDialogOpen(false);
    },
    onError: (error) => {
      unitForm.setError("root", { message: getApiError(error).message });
    }
  });

  const reorderUnitMutation = useMutation({
    mutationFn: async ({ current, target }: { current: UnitType; target: UnitType }) => {
      await updateUnitType(workTypeId!, current.id, {
        name: current.name,
        unitsPerHour: Number(current.unitsPerHour),
        displayOrder: target.displayOrder,
        active: current.active
      });
      await updateUnitType(workTypeId!, target.id, {
        name: target.name,
        unitsPerHour: Number(target.unitsPerHour),
        displayOrder: current.displayOrder,
        active: target.active
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.unitTypes.list(workTypeId!) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.unitTypes.all() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.workTypes.all() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.workEntries.all() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.statistics.all() })
      ]);
    }
  });

  function openUnitDialog() {
    unitForm.clearErrors();
    unitForm.reset({ name: "", unitsPerHour: "" });
    setSelectedUnitType(null);
    setUnitDialogOpen(true);
  }

  function openUnitEditDialog(unitType: UnitType) {
    unitForm.clearErrors();
    unitForm.reset({
      name: unitType.name,
      unitsPerHour: unitType.unitsPerHour
    });
    setSelectedUnitType(unitType);
    setUnitDialogOpen(true);
  }

  function closeUnitDialog() {
    if (createUnitMutation.isPending || updateUnitMutation.isPending || deleteUnitMutation.isPending || reorderUnitMutation.isPending) return;
    setUnitDialogOpen(false);
    setSelectedUnitType(null);
    unitForm.reset({ name: "", unitsPerHour: "" });
  }

  function moveUnit(unitType: UnitType, direction: -1 | 1) {
    const currentIndex = orderedUnitTypes.findIndex((unit) => unit.id === unitType.id);
    const target = orderedUnitTypes[currentIndex + direction];
    if (!target) return;
    reorderUnitMutation.mutate({ current: unitType, target });
  }

  const { confirmOrRun, dialog } = useUnsavedChangesGuard({
    isDirty:
      form.formState.isDirty &&
      !saveMutation.isPending &&
      !deleteMutation.isPending
  });

  if (workTypeQuery.isLoading) {
    return <SettingsPageSkeleton />;
  }

  if (workTypeQuery.error) {
    return <ScreenMessage title={t("settings:workTypeEditor.unavailableTitle")} description={getApiError(workTypeQuery.error).message} />;
  }

  const headerTitle = isEditing
    ? workTypeQuery.data?.name ?? t("settings:workTypeEditor.editTitle")
    : t("settings:workTypeEditor.addTitle");
  const orderedUnitTypes = [...(unitTypesQuery.data ?? [])].sort((left, right) => {
    return left.displayOrder - right.displayOrder || left.name.localeCompare(right.name);
  });

  return (
    <div className="space-y-8 pb-10">
      <SettingsPageHeader
        title={headerTitle}
        fallbackHref="/settings/work-types"
        onBack={() => confirmOrRun(safeBack)}
      />
      <form
        noValidate
        className="space-y-6"
        onSubmit={form.handleSubmit(
          async (values) => {
            form.clearErrors("root");
            try {
              await saveMutation.mutateAsync(values);
            } catch {
              // Mutation state renders field and global API errors without leaving the form.
            }
          },
          () => {
            form.setError("root", {
              message: t("settings:workTypeEditor.validation.fixErrors")
            });
          }
        )}
      >
        {form.formState.errors.root?.message ? (
          <p
            role="alert"
            className="rounded-[22px] border border-red-400/20 bg-red-400/[0.08] px-4 py-3 text-sm text-red-100"
          >
            {form.formState.errors.root.message}
          </p>
        ) : null}
        <SettingsSection title={t("settings:workTypeEditor.coreSettings")}>
          <div className="space-y-4">
            <Input
              label={t("settings:workTypeEditor.fields.name")}
              error={form.formState.errors.name?.message}
              {...form.register("name", {
                onChange: (event) => {
                  const input = event.target as HTMLInputElement;
                  const upperValue = input.value.toLocaleUpperCase();
                  if (input.value !== upperValue) {
                    input.value = upperValue;
                  }
                }
              })}
            />
            <Select label={t("settings:workTypeEditor.fields.calculationMethod")} error={form.formState.errors.calculationMethod?.message} {...form.register("calculationMethod")}>
              <option value="TIME_BASED">{t("entries:workTypePicker.timeBased")}</option>
              <option value="UNIT_BASED">{t("entries:workTypePicker.unitBased")}</option>
            </Select>
            {isEditing ? (
              <ColorPicker
                label={t("settings:workTypeEditor.fields.color")}
                value={form.watch("color") ?? "#FFFFFF"}
                onChange={(value) => {
                  form.setValue("color", value, {
                    shouldDirty: true,
                    shouldTouch: true,
                    shouldValidate: true
                  });
                }}
              />
            ) : null}
          </div>
        </SettingsSection>

        {isEditing && workTypeQuery.data?.calculationMethod === "UNIT_BASED" ? (
          <SettingsSection
            title={t("settings:unitTypes.sectionTitle")}
          >
            <div className="space-y-4">
              {orderedUnitTypes.length ? (
                <div className="space-y-3">
                  {orderedUnitTypes.map((unit, index) => (
                    <div
                      key={unit.id}
                      className="dashboard-glass-card flex w-full items-center gap-3 px-5 py-5 transition hover:bg-white/[0.06]"
                    >
                      <button
                        type="button"
                        aria-label={t("settings:unitTypes.editUnit", { name: unit.name })}
                        onClick={() => openUnitEditDialog(unit)}
                        className="min-w-0 flex-1 text-left focus:outline-none focus:ring-2 focus:ring-white/24"
                      >
                        <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0 space-y-1.5">
                          <p className={`text-[1.05rem] font-semibold tracking-[-0.04em] ${unit.active ? "text-white" : "text-white/42"}`}>
                            {unit.name}
                          </p>
                          <p className="inline-flex items-center gap-1.5 text-sm font-medium text-white/46">
                            <Clock3 className="h-3.5 w-3.5 text-white/28" aria-hidden="true" />
                            <span>{unit.unitsPerHour}</span>
                          </p>
                        </div>
                        {!unit.active ? (
                          <span className="text-xs uppercase tracking-[0.16em] text-white/28">
                            {t("settings:status.inactive")}
                          </span>
                        ) : null}
                        </div>
                      </button>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          aria-label={t("settings:unitTypes.moveUp", { name: unit.name })}
                          disabled={index === 0 || reorderUnitMutation.isPending}
                          onClick={() => moveUnit(unit, -1)}
                          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.035] text-white/52 transition hover:bg-white/[0.07] hover:text-white disabled:cursor-not-allowed disabled:opacity-25"
                        >
                          <ArrowUp className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          aria-label={t("settings:unitTypes.moveDown", { name: unit.name })}
                          disabled={index === orderedUnitTypes.length - 1 || reorderUnitMutation.isPending}
                          onClick={() => moveUnit(unit, 1)}
                          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.035] text-white/52 transition hover:bg-white/[0.07] hover:text-white disabled:cursor-not-allowed disabled:opacity-25"
                        >
                          <ArrowDown className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <SettingsEmptyState
                  title={t("settings:unitTypes.emptyTitle")}
                  description={t("settings:unitTypes.emptyDescription")}
                  actionLabel={t("settings:unitTypes.addFirst")}
                  onAction={openUnitDialog}
                />
              )}
              {orderedUnitTypes.length ? (
                <Button type="button" variant="secondary" className="w-full" onClick={openUnitDialog}>
                  {t("settings:unitTypes.add")}
                </Button>
              ) : null}
            </div>
          </SettingsSection>
        ) : null}

        <SettingsFormActions
          submitting={saveMutation.isPending}
          successMessage={successMessage}
          onDelete={isEditing ? () => setShowConfirm(true) : undefined}
          deleteLabel={isEditing ? t("settings:workTypeEditor.deactivate") : undefined}
          deleteDisabled={deleteMutation.isPending}
        />
      </form>

      <SettingsConfirmDialog
        open={showConfirm}
        title={t("settings:workTypeEditor.deactivateTitle")}
        description={t("settings:workTypeEditor.deactivateDescription")}
        confirmLabel={t("settings:workTypeEditor.deactivateConfirm")}
        pending={deleteMutation.isPending}
        onCancel={() => setShowConfirm(false)}
        onConfirm={() => void deleteMutation.mutateAsync()}
      />
      <UnitTypeCreateDialog
        open={unitDialogOpen}
        mode={selectedUnitType ? "edit" : "create"}
        pending={createUnitMutation.isPending || updateUnitMutation.isPending || deleteUnitMutation.isPending}
        form={unitForm}
        onClose={closeUnitDialog}
        onSubmit={(values) =>
          selectedUnitType
            ? updateUnitMutation.mutateAsync({ unitType: selectedUnitType, values })
            : createUnitMutation.mutateAsync(values)
        }
        onDeactivate={
          selectedUnitType
            ? () => deleteUnitMutation.mutateAsync(selectedUnitType)
            : undefined
        }
      />
      {dialog}
    </div>
  );
}

function ColorPicker({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="hairline-text">{label}</p>
      <div className="grid grid-cols-6 gap-2">
        {WORK_TYPE_COLORS.map((option) => {
          const selected = option.toLocaleUpperCase() === value.toLocaleUpperCase();
          return (
            <button
              key={option}
              type="button"
              aria-label={`${label} ${option}`}
              aria-pressed={selected}
              onClick={() => onChange(option)}
              className="flex h-10 items-center justify-center rounded-full border transition focus:outline-none focus:ring-2 focus:ring-white/24"
              style={{
                borderColor: selected ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.1)",
                backgroundColor: "rgba(255,255,255,0.035)"
              }}
            >
              <span
                className="h-5 w-5 rounded-full"
                style={{ backgroundColor: option }}
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function UnitTypeCreateDialog({
  open,
  mode,
  pending,
  form,
  onClose,
  onSubmit,
  onDeactivate
}: {
  open: boolean;
  mode: "create" | "edit";
  pending: boolean;
  form: ReturnType<typeof useForm<UnitDialogInput, undefined, UnitDialogValues>>;
  onClose: () => void;
  onSubmit: (values: UnitDialogValues) => Promise<unknown>;
  onDeactivate?: () => Promise<unknown>;
}) {
  const { t } = useTranslation(["settings", "common"]);
  const unitsPerHourField = form.register("unitsPerHour");

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-[calc(env(safe-area-inset-top)+1.5rem)] backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="unit-type-dialog-title"
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label={t("common:actions.cancel")}
        className="absolute inset-0 h-full w-full cursor-default"
        onClick={onClose}
      />
      <form
        noValidate
        className="relative z-10 w-full max-w-sm rounded-[32px] border border-white/[0.08] bg-[#090909]/95 p-5 shadow-[0_28px_90px_rgba(0,0,0,0.55)]"
        onSubmit={form.handleSubmit(
          async (values) => {
            form.clearErrors("root");
            try {
              await onSubmit(values);
            } catch {
              // Mutation state renders the API error and keeps the dialog open.
            }
          },
          () => {
            form.setError("root", { message: t("settings:unitTypes.validation.fixErrors") });
          }
        )}
      >
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 id="unit-type-dialog-title" className="text-xl font-semibold tracking-[-0.06em] text-white">
            {mode === "edit" ? t("settings:unitTypes.editTitle") : t("settings:unitTypes.addTitle")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-full px-3 py-2 text-sm font-semibold text-white/48 transition hover:text-white disabled:opacity-50"
          >
            {t("common:actions.cancel")}
          </button>
        </div>

        <div className="space-y-4">
          {form.formState.errors.root?.message ? (
            <p
              role="alert"
              className="rounded-[22px] border border-red-400/20 bg-red-400/[0.08] px-4 py-3 text-sm text-red-100"
            >
              {form.formState.errors.root.message}
            </p>
          ) : null}
          <Input
            label={t("settings:unitTypes.fields.name")}
            error={form.formState.errors.name?.message}
            {...form.register("name")}
          />
          <Input
            type="text"
            inputMode="decimal"
            placeholder={t("settings:unitTypes.unitsPerHourPlaceholder")}
            label={t("settings:unitTypes.fields.unitsPerHour")}
            autoComplete="off"
            error={form.formState.errors.unitsPerHour?.message}
            {...unitsPerHourField}
            onFocus={(event) => {
              if (event.currentTarget.value === "NaN") {
                event.currentTarget.value = "";
                form.setValue("unitsPerHour", "", {
                  shouldDirty: false,
                  shouldTouch: false,
                  shouldValidate: false
                });
              }
            }}
            onChange={(event) => {
              const sanitized = event.currentTarget.value.replace(/[^\d.,]/g, "");
              if (event.currentTarget.value !== sanitized) {
                event.currentTarget.value = sanitized;
              }
              void unitsPerHourField.onChange(event);
            }}
          />
          <div className="grid gap-3">
            {onDeactivate ? (
              <Button
                type="button"
                variant="secondary"
                className="w-full border-red-400/18 bg-red-400/[0.05] text-white hover:bg-red-400/[0.08]"
                disabled={pending}
                onClick={() => {
                  void onDeactivate();
                }}
              >
                {t("settings:unitTypes.deactivate")}
              </Button>
            ) : null}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? t("common:actions.saving") : t("common:actions.save")}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

function formatWorkTypeError(message: string, savedEntriesMessage?: string) {
  if (message.toLowerCase().includes("saved entries")) {
    return savedEntriesMessage ?? message;
  }
  return message;
}

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Clock3, Coins, Ruler } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { getApiError } from "../api/api-errors";
import { queryKeys } from "../api/query-keys";
import {
  createWorkType,
  deleteWorkType,
  getWorkType,
  listWorkTypes,
  updateWorkType
} from "../api/endpoints";
import { SettingsConfirmDialog } from "../components/settings/settings-confirm-dialog";
import { SettingsEmptyState } from "../components/settings/settings-empty-state";
import { SettingsFormActions } from "../components/settings/settings-form-actions";
import { SettingsPageSkeleton } from "../components/settings/settings-page-skeleton";
import { SettingsSection } from "../components/settings/settings-section";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { ScreenMessage } from "../components/ui/screen-message";
import { useSafeBackNavigation } from "../hooks/use-safe-back-navigation";
import { useUnsavedChangesGuard } from "../hooks/use-unsaved-changes-guard";
import type { WorkType, WorkTypeFormula, WorkTypeFormulaMode } from "../types/configuration";
import type { CalculationMethod, CompensationMethod } from "../types/work-calculation";

const DEFAULT_WORK_TYPE_COLOR = "#A3E635";

function createWorkTypeSchema(t: (key: string) => string) {
  return z.object({
	    name: z.string()
	      .trim()
	      .transform((value) => value.toLocaleUpperCase())
	      .pipe(z.string().min(1, t("workTypeEditor.validation.nameRequired")).max(100, t("workTypeEditor.validation.nameTooLong"))),
		    calculationMethod: z.enum(["TIME_BASED", "UNIT_BASED", "UNITS_PER_HOUR_BASED", "FIXED_PRICE_BASED"]),
		    compensationMethod: z.enum(["HOURLY", "PER_UNIT"]).default("HOURLY"),
        unitLabel: z.string().trim().max(100).optional().or(z.literal("")),
        unitSymbol: z.string().trim().max(20).optional().or(z.literal("")),
        unitsPerHour: optionalDecimalSchema(t("workTypeFormulas.validation.unitsPerHour")),
        ratePerUnit: optionalDecimalSchema(t("workTypeFormulas.validation.ratePerUnit")),
        currency: z.string().trim().length(3, t("workTypeFormulas.validation.currency")).optional().or(z.literal("")),
        teamworkEnabled: z.boolean().optional().default(false),
        compositeEnabled: z.boolean().optional().default(false),
		    color: z.preprocess(
          (value) => value == null || value === "" ? DEFAULT_WORK_TYPE_COLOR : value,
          z.string().regex(/^#[0-9A-Fa-f]{6}$/)
        ),
	    defaultBreakMinutes: z.coerce.number().int().min(0).optional(),
	    active: z.boolean().optional().default(true)
  }).superRefine((value, context) => {
    if (value.compositeEnabled) {
      return;
    }
    if (value.calculationMethod === "TIME_BASED" || value.calculationMethod === "FIXED_PRICE_BASED") {
      return;
    }
    if (!value.unitLabel?.trim()) {
      context.addIssue({ code: "custom", path: ["unitLabel"], message: t("workTypeFormulas.validation.unitLabel") });
    }
    if (value.calculationMethod === "UNITS_PER_HOUR_BASED" && !Number.isFinite(value.unitsPerHour)) {
      context.addIssue({ code: "custom", path: ["unitsPerHour"], message: t("workTypeFormulas.validation.unitsPerHour") });
    }
    if (value.calculationMethod === "UNIT_BASED") {
      if (!Number.isFinite(value.ratePerUnit)) {
        context.addIssue({ code: "custom", path: ["ratePerUnit"], message: t("workTypeFormulas.validation.ratePerUnit") });
      }
      if (!value.currency?.trim()) {
        context.addIssue({ code: "custom", path: ["currency"], message: t("workTypeFormulas.validation.currency") });
      }
    }
  });
}

function parseDecimalInput(value: unknown) {
  if (typeof value === "string") {
    const normalized = value.trim().replace(",", ".");
    return normalized === "" ? undefined : Number(normalized);
  }
  return value;
}

function optionalDecimalSchema(message: string) {
  return z.preprocess(
    parseDecimalInput,
    z.number({ error: message }).gt(0, message).optional()
  );
}

type Schema = ReturnType<typeof createWorkTypeSchema>;
type FormValues = z.infer<Schema>;
type FormInput = z.input<Schema>;

function createConfigurationDialogSchema(t: (key: string) => string) {
  return z.object({
    name: z.string().trim().min(1, t("workTypeFormulas.validation.nameRequired")).max(120, t("workTypeFormulas.validation.nameTooLong")),
    calculationMode: z.enum(["TIME_HOURLY", "UNITS_PER_HOUR", "UNITS_PER_UNIT", "FIXED_AMOUNT"]),
    unitLabel: z.string().trim().max(100).optional().or(z.literal("")),
    unitSymbol: z.string().trim().max(20).optional().or(z.literal("")),
    unitsPerHour: optionalDecimalSchema(t("workTypeFormulas.validation.unitsPerHour")),
    ratePerUnit: optionalDecimalSchema(t("workTypeFormulas.validation.ratePerUnit")),
    currency: z.string().trim().length(3, t("workTypeFormulas.validation.currency")).optional().or(z.literal("")),
    defaultBreakMinutes: z.coerce.number().int().min(0).optional()
  });
}

type ConfigurationDialogSchema = ReturnType<typeof createConfigurationDialogSchema>;
type ConfigurationDialogValues = z.infer<ConfigurationDialogSchema>;
type ConfigurationDialogInput = z.input<ConfigurationDialogSchema>;
type DraftChildWorkType = {
  id: string;
  name: string;
  unitLabel: string;
  unitSymbol: string;
  unitsPerHour: string;
  ratePerUnit: string;
  currency: string;
  defaultBreakMinutes: string;
};

export function WorkTypeEditorPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation(["settings", "common", "records", "errors"]);
  const queryClient = useQueryClient();
  const { workTypeId } = useParams();
  const isEditing = Boolean(workTypeId);
  const setupModeFromSearch = !isEditing
    ? parseSetupMode(new URLSearchParams(location.search).get("mode"))
    : null;
  const setupState = !isEditing
    ? (location.state as {
      setupMode?: WorkTypeFormulaMode;
      calculationMethod?: CalculationMethod;
      compensationMethod?: CompensationMethod;
    } | null)
    : null;
  const initialSetupMode = !isEditing
    ? (setupModeFromSearch ?? setupState?.setupMode ?? null)
    : null;
  const initialSetupOption = initialSetupMode
    ? setupModeOptions(t).find((option) => option.mode === initialSetupMode) ?? null
    : null;
  const initialCalculationMethod = initialSetupOption?.calculationMethod ?? setupState?.calculationMethod ?? "TIME_BASED";
  const initialCompensationMethod = initialSetupOption?.compensationMethod ?? setupState?.compensationMethod ?? "HOURLY";
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedSetupMode, setSelectedSetupMode] = useState<WorkTypeFormulaMode | null>(initialSetupOption?.mode ?? null);
  const [configurationDialogOpen, setConfigurationDialogOpen] = useState(false);
  const [selectedConfiguration, setSelectedConfiguration] = useState<WorkTypeFormula | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [suppressUnsavedGuard, setSuppressUnsavedGuard] = useState(false);
  const [draftChildren, setDraftChildren] = useState<DraftChildWorkType[]>([]);
  const navigationTimeoutRef = useRef<number | null>(null);
  const safeBack = useSafeBackNavigation({ fallback: "/settings/work-types" });
  const schema = useMemo(() => createWorkTypeSchema((key) => t(`settings:${key}`)), [t]);
  const configurationDialogSchema = useMemo(
    () => createConfigurationDialogSchema((key) => t(`settings:${key}`)),
    [t]
  );

  const workTypeQuery = useQuery({
    queryKey: workTypeId ? queryKeys.workTypes.detail(workTypeId) : queryKeys.workTypes.all(),
    queryFn: () => getWorkType(workTypeId!),
    enabled: isEditing
  });

  const childWorkTypesQuery = useQuery({
    queryKey: queryKeys.workTypes.all(),
    queryFn: listWorkTypes,
    enabled: Boolean(workTypeId)
  });

  const form = useForm<FormInput, undefined, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
	      name: "",
		      calculationMethod: initialCalculationMethod,
		      compensationMethod: initialCompensationMethod,
          unitLabel: "",
          unitSymbol: "",
          unitsPerHour: "",
          ratePerUnit: "",
          currency: "EUR",
          teamworkEnabled: false,
          compositeEnabled: false,
		      color: DEFAULT_WORK_TYPE_COLOR,
	      defaultBreakMinutes: 30,
	      active: true
    }
  });

  useEffect(() => {
    if (isEditing || !initialSetupMode) {
      return;
    }

    form.setValue("calculationMethod", initialCalculationMethod, {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: true
    });
    form.setValue("compensationMethod", initialCompensationMethod, {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: true
    });
    setSelectedSetupMode(initialSetupMode);
  }, [form, initialCalculationMethod, initialCompensationMethod, initialSetupMode, isEditing]);

  useEffect(() => () => {
    if (navigationTimeoutRef.current !== null) {
      window.clearTimeout(navigationTimeoutRef.current);
    }
  }, []);
  const configurationForm = useForm<ConfigurationDialogInput, undefined, ConfigurationDialogValues>({
    resolver: zodResolver(configurationDialogSchema),
    defaultValues: {
      name: "",
      calculationMode: "TIME_HOURLY",
      unitLabel: "",
      unitSymbol: "",
      unitsPerHour: "",
      ratePerUnit: "",
      currency: "EUR",
      defaultBreakMinutes: 30
    }
  });

  useEffect(() => {
    if (!workTypeQuery.data) return;
    form.reset({
		      name: workTypeQuery.data.name,
		      calculationMethod: workTypeQuery.data.calculationMethod,
		      compensationMethod: workTypeQuery.data.compensationMethod ?? "HOURLY",
          unitLabel: workTypeQuery.data.unitLabel ?? "",
          unitSymbol: workTypeQuery.data.unitSymbol ?? "",
          unitsPerHour: workTypeQuery.data.unitsPerHour ?? "",
          ratePerUnit: workTypeQuery.data.ratePerUnit ?? "",
          currency: workTypeQuery.data.currency ?? "EUR",
          teamworkEnabled: workTypeQuery.data.teamworkEnabled ?? false,
          compositeEnabled: workTypeQuery.data.compositeEnabled ?? false,
	      color: workTypeQuery.data.color ?? DEFAULT_WORK_TYPE_COLOR,
	      defaultBreakMinutes: workTypeQuery.data.defaultBreakMinutes ?? 30,
	      active: workTypeQuery.data.active
    });
  }, [form, workTypeQuery.data]);

  async function afterSuccess(targetId?: string, shouldStayInEditor?: boolean) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.workTypes.all() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.workRecords.all() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.statistics.all() })
    ]);

    if (navigationTimeoutRef.current !== null) {
      window.clearTimeout(navigationTimeoutRef.current);
    }
    navigationTimeoutRef.current = window.setTimeout(() => {
      if (targetId && (isEditing || shouldStayInEditor)) {
        navigate(`/settings/work-types/${targetId}`, { replace: true });
        return;
      }
      navigate("/settings/work-types", { replace: true });
    }, 520);
  }

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const normalizedValues: FormValues = !isEditing && initialSetupOption
        ? {
          ...values,
          calculationMethod: initialSetupOption.calculationMethod,
          compensationMethod: initialSetupOption.compensationMethod
        }
        : values;
      const payload = buildWorkTypePayload(normalizedValues, {
        color: normalizedValues.color ?? DEFAULT_WORK_TYPE_COLOR,
        displayOrder: workTypeQuery.data?.displayOrder ?? undefined,
        active: workTypeQuery.data?.active ?? true
      });
      if (isEditing) {
	        return updateWorkType(workTypeId!, {
            ...payload,
            parentId: workTypeQuery.data?.parentId ?? null
          });
      }

      const workType = await createWorkType(payload);
      if (normalizedValues.compositeEnabled) {
        const childMode = workTypeSetupMode(normalizedValues.calculationMethod) ?? "TIME_HOURLY";
        await Promise.all(
          draftChildren
            .filter(hasDraftChildContent)
            .map((child, index) =>
              createWorkType(buildDraftChildWorkTypePayload(child, childMode, {
                parentId: workType.id,
                color: normalizedValues.color,
                teamworkEnabled: normalizedValues.teamworkEnabled ?? false,
                displayOrder: index,
                active: true
              }))
            )
        );
      }
	      return workType;
    },
    onSuccess: async (workType) => {
      setSuppressUnsavedGuard(true);
      form.reset(form.getValues());
      setSuccessMessage(isEditing ? t("settings:workTypeEditor.updated") : t("settings:workTypeEditor.created"));
      await afterSuccess(workType.id, workType.compositeEnabled);
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

  const createConfigurationMutation = useMutation({
    mutationFn: (values: ConfigurationDialogValues) =>
      createWorkType(buildChildWorkTypePayload(values, {
        parentId: workTypeId!,
        color: workTypeQuery.data?.color ?? DEFAULT_WORK_TYPE_COLOR,
        teamworkEnabled: workTypeQuery.data?.teamworkEnabled ?? false,
        active: true
      })),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.workTypes.all() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.workRecords.all() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.statistics.all() })
      ]);
      resetConfigurationDialog();
    },
    onError: (error) => {
      const apiError = getApiError(error);
      Object.entries(apiError.fieldErrors).forEach(([field, message]) => {
        configurationForm.setError(field as keyof ConfigurationDialogValues, { message });
      });
      configurationForm.setError("root", { message: apiError.message });
    }
  });

  const updateConfigurationMutation = useMutation({
    mutationFn: ({ configuration, values }: { configuration: WorkTypeFormula; values: ConfigurationDialogValues }) =>
      updateWorkType(
        configuration.id,
        buildChildWorkTypePayload(values, {
          parentId: workTypeId!,
          color: workTypeQuery.data?.color ?? DEFAULT_WORK_TYPE_COLOR,
          teamworkEnabled: workTypeQuery.data?.teamworkEnabled ?? false,
          active: configuration.active,
          displayOrder: configuration.displayOrder
        })
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.workTypes.all() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.workRecords.all() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.statistics.all() })
      ]);
      resetConfigurationDialog();
    },
    onError: (error) => {
      const apiError = getApiError(error);
      Object.entries(apiError.fieldErrors).forEach(([field, message]) => {
        configurationForm.setError(field as keyof ConfigurationDialogValues, { message });
      });
      configurationForm.setError("root", { message: apiError.message });
    }
  });

  const deleteConfigurationMutation = useMutation({
    mutationFn: (configuration: WorkTypeFormula) => deleteWorkType(configuration.id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.workTypes.all() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.workRecords.all() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.statistics.all() })
      ]);
      resetConfigurationDialog();
    },
    onError: (error) => {
      configurationForm.setError("root", { message: getApiError(error).message });
    }
  });

  function resetConfigurationDialog() {
    configurationForm.reset({
      name: "",
      calculationMode: selectedSetupMode ?? "TIME_HOURLY",
      unitLabel: "",
      unitSymbol: "",
      unitsPerHour: "",
      ratePerUnit: "",
      currency: "EUR",
      defaultBreakMinutes: 30
    });
    setSelectedConfiguration(null);
    setConfigurationDialogOpen(false);
  }

  function openConfigurationDialog(mode?: WorkTypeFormulaMode) {
    const nextMode = mode ?? selectedSetupMode ?? "TIME_HOURLY";
    configurationForm.clearErrors();
    configurationForm.reset({
      name: "",
      calculationMode: nextMode,
      unitLabel: "",
      unitSymbol: "",
      unitsPerHour: "",
      ratePerUnit: "",
      currency: "EUR",
      defaultBreakMinutes: 30
    });
    setSelectedConfiguration(null);
    setConfigurationDialogOpen(true);
  }

  function openConfigurationEditDialog(configuration: WorkTypeFormula) {
    configurationForm.clearErrors();
    configurationForm.reset({
      name: configuration.name,
      calculationMode: configuration.calculationMode,
      unitLabel: configuration.unitLabel ?? "",
      unitSymbol: configuration.unitSymbol ?? "",
      unitsPerHour: configuration.unitsPerHour ?? "",
      ratePerUnit: configuration.ratePerUnit ?? "",
      currency: configuration.currency ?? "EUR",
      defaultBreakMinutes: configuration.defaultBreakMinutes ?? 30
    });
    setSelectedConfiguration(configuration);
    setConfigurationDialogOpen(true);
  }

  function closeConfigurationDialog() {
    if (
      createConfigurationMutation.isPending ||
      updateConfigurationMutation.isPending ||
      deleteConfigurationMutation.isPending
    ) {
      return;
    }
    resetConfigurationDialog();
  }

  const { confirmOrRun, dialog } = useUnsavedChangesGuard({
    isDirty:
      !suppressUnsavedGuard &&
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
  const watchedCalculationMethod = form.watch("calculationMethod");
  const selectedCalculationMethod = !isEditing && initialSetupOption
    ? initialSetupOption.calculationMethod
    : watchedCalculationMethod;
  const compositeEnabled = form.watch("compositeEnabled");
  const parentOnly = Boolean(compositeEnabled);
  const childDraftMode = selectedSetupMode ?? workTypeSetupMode(selectedCalculationMethod) ?? "TIME_HOURLY";
  const editorSectionTitle = workTypeEditorSectionTitle(selectedCalculationMethod, t);
  const deletionMode = workTypeQuery.data?.deletable ? "delete" : "deactivate";
  const unitsPerHourField = form.register("unitsPerHour");
  const ratePerUnitField = form.register("ratePerUnit");
  const orderedConfigurations = [...(childWorkTypesQuery.data ?? [])]
    .filter((workType) => workType.parentId === workTypeId)
    .map(workTypeToConfiguration)
    .sort((left, right) => {
    return left.displayOrder - right.displayOrder || left.name.localeCompare(right.name);
  });

  function normalizeFormForCurrentMode() {
    const calculationMethod = selectedCalculationMethod;
    form.setValue("calculationMethod", calculationMethod, { shouldDirty: false, shouldTouch: false, shouldValidate: false });
    form.setValue("compensationMethod", calculationMethod === "UNIT_BASED" ? "PER_UNIT" : "HOURLY", {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: false
    });
    form.setValue("color", form.getValues("color") || DEFAULT_WORK_TYPE_COLOR, {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: false
    });

    if (calculationMethod === "TIME_BASED") {
      form.setValue("unitLabel", "", { shouldDirty: false, shouldTouch: false, shouldValidate: false });
      form.setValue("unitSymbol", "", { shouldDirty: false, shouldTouch: false, shouldValidate: false });
      form.setValue("unitsPerHour", "", { shouldDirty: false, shouldTouch: false, shouldValidate: false });
      form.setValue("ratePerUnit", "", { shouldDirty: false, shouldTouch: false, shouldValidate: false });
      form.setValue("currency", "EUR", { shouldDirty: false, shouldTouch: false, shouldValidate: false });
      form.setValue("defaultBreakMinutes", form.getValues("defaultBreakMinutes") ?? 0, {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: false
      });
      return;
    }

    if (calculationMethod === "FIXED_PRICE_BASED") {
      form.setValue("unitLabel", "", { shouldDirty: false, shouldTouch: false, shouldValidate: false });
      form.setValue("unitSymbol", "", { shouldDirty: false, shouldTouch: false, shouldValidate: false });
      form.setValue("unitsPerHour", "", { shouldDirty: false, shouldTouch: false, shouldValidate: false });
      form.setValue("ratePerUnit", "", { shouldDirty: false, shouldTouch: false, shouldValidate: false });
      form.setValue("currency", "EUR", { shouldDirty: false, shouldTouch: false, shouldValidate: false });
      form.setValue("defaultBreakMinutes", undefined, { shouldDirty: false, shouldTouch: false, shouldValidate: false });
      return;
    }

    if (calculationMethod === "UNITS_PER_HOUR_BASED") {
      form.setValue("ratePerUnit", "", { shouldDirty: false, shouldTouch: false, shouldValidate: false });
      form.setValue("currency", "EUR", { shouldDirty: false, shouldTouch: false, shouldValidate: false });
      form.setValue("defaultBreakMinutes", undefined, { shouldDirty: false, shouldTouch: false, shouldValidate: false });
      return;
    }

    form.setValue("unitsPerHour", "", { shouldDirty: false, shouldTouch: false, shouldValidate: false });
    form.setValue("defaultBreakMinutes", undefined, { shouldDirty: false, shouldTouch: false, shouldValidate: false });
  }

  if (!isEditing && !selectedSetupMode) {
    return (
      <WorkTypeEditorShell
          title={t("settings:workTypeEditor.chooseModeTitle")}
          backLabel={t("common:actions.back")}
          onBack={() => confirmOrRun(safeBack)}
      >
          <div className="grid grid-cols-2 gap-3">
            {setupModeOptions(t).map((option) => (
              <button
                key={option.mode}
                type="button"
                className="min-h-[9.4rem] rounded-[26px] border border-white/[0.08] bg-white/[0.045] px-3.5 py-4 text-left transition hover:-translate-y-0.5 hover:bg-white/[0.075] active:translate-y-0 focus:outline-none focus:ring-2 focus:ring-white/24"
                onClick={() => {
                  setSelectedSetupMode(option.mode);
                  form.setValue("calculationMethod", option.calculationMethod, {
                    shouldDirty: true,
                    shouldTouch: true,
                    shouldValidate: true
                  });
                  form.setValue("compensationMethod", option.compensationMethod, {
                    shouldDirty: true,
                    shouldTouch: true,
                    shouldValidate: true
                  });
                  form.setValue("name", option.suggestedName, {
                    shouldDirty: true,
                    shouldTouch: false,
                    shouldValidate: false
                  });
                }}
              >
                <span className="flex h-full flex-col justify-between gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.07] text-white/68 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                  {option.icon}
                </span>
                <span className="min-w-0 space-y-2">
                  <span className="block text-[1rem] font-semibold leading-[1.05] tracking-[-0.045em] text-white">
                    {option.title}
                  </span>
                  <span className="block min-h-8 text-[0.68rem] font-semibold uppercase leading-4 tracking-[0.11em] text-white/34">
                    {option.formula}
                  </span>
                </span>
                </span>
              </button>
            ))}
          </div>
        {dialog}
      </WorkTypeEditorShell>
    );
  }

  return (
    <WorkTypeEditorShell
        title={headerTitle}
        backLabel={t("common:actions.back")}
        onBack={() => confirmOrRun(safeBack)}
    >
      <form
        noValidate
        className="space-y-6"
        onSubmit={(event) => {
          normalizeFormForCurrentMode();
          void form.handleSubmit(
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
          )(event);
        }}
      >
        {form.formState.errors.root?.message ? (
          <p
            role="alert"
            className="rounded-[22px] border border-red-400/20 bg-red-400/[0.08] px-4 py-3 text-sm text-red-100"
          >
            {form.formState.errors.root.message}
          </p>
        ) : null}
        {selectedCalculationMethod === "TIME_BASED" ? (
          <WorkTypeInfoCard
            icon={<Clock3 className="h-6 w-6" aria-hidden="true" />}
            title={t("settings:workTypeEditor.info.timeTitle")}
            description={t("settings:workTypeEditor.info.timeDescription")}
            details={[
              {
                label: t("settings:workTypeEditor.info.configureLabel"),
                value: t("settings:workTypeEditor.info.timeConfigureValue")
              },
              {
                label: t("settings:workTypeEditor.info.resultLabel"),
                value: t("settings:workTypeEditor.info.timeResultValue")
              }
            ]}
          />
        ) : null}
        {selectedCalculationMethod === "UNITS_PER_HOUR_BASED" ? (
          <WorkTypeInfoCard
            icon={<Ruler className="h-6 w-6" aria-hidden="true" />}
            title={t("settings:workTypeEditor.info.unitsPerHourTitle")}
            description={t("settings:workTypeEditor.info.unitsPerHourDescription")}
            details={[
              { label: t("settings:workTypeEditor.info.configureLabel"), value: t("settings:workTypeEditor.info.unitsPerHourConfigureValue") },
              { label: t("settings:workTypeEditor.info.resultLabel"), value: t("settings:workTypeEditor.info.unitsPerHourResultValue") }
            ]}
          />
        ) : null}
        {selectedCalculationMethod === "UNIT_BASED" ? (
          <WorkTypeInfoCard
            icon={<Coins className="h-6 w-6" aria-hidden="true" />}
            title={t("settings:workTypeEditor.info.perUnitTitle")}
            description={t("settings:workTypeEditor.info.perUnitDescription")}
            details={[
              { label: t("settings:workTypeEditor.info.configureLabel"), value: t("settings:workTypeEditor.info.perUnitConfigureValue") },
              { label: t("settings:workTypeEditor.info.resultLabel"), value: t("settings:workTypeEditor.info.perUnitResultValue") }
            ]}
          />
        ) : null}
        {selectedCalculationMethod === "FIXED_PRICE_BASED" ? (
          <WorkTypeInfoCard
            icon={<Coins className="h-6 w-6" aria-hidden="true" />}
            title={t("settings:workTypeEditor.info.fixedTitle")}
            description={t("settings:workTypeEditor.info.fixedDescription")}
            details={[
              { label: t("settings:workTypeEditor.info.configureLabel"), value: t("settings:workTypeEditor.info.fixedConfigureValue") },
              { label: t("settings:workTypeEditor.info.resultLabel"), value: t("settings:workTypeEditor.info.fixedResultValue") }
            ]}
          />
        ) : null}
        <SettingsSection title={editorSectionTitle}>
          <div className="space-y-4">
	            <Input
	              label={parentOnly ? t("settings:workTypeEditor.fields.categoryName") : t("settings:workTypeEditor.fields.name")}
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
              <Input
                label={t("settings:workTypeEditor.fields.color")}
                type="color"
                className="h-12 p-2"
                error={form.formState.errors.color?.message}
                {...form.register("color")}
              />
	            {!parentOnly && selectedCalculationMethod === "TIME_BASED" ? (
	              <Input
	                type="number"
	                inputMode="numeric"
	                min={0}
	                label={t("settings:workTypeEditor.fields.defaultBreakMinutes")}
	                error={form.formState.errors.defaultBreakMinutes?.message}
	                {...form.register("defaultBreakMinutes")}
	              />
	            ) : null}
              {!parentOnly && selectedCalculationMethod !== "TIME_BASED" && selectedCalculationMethod !== "FIXED_PRICE_BASED" ? (
                <div className="grid grid-cols-[minmax(0,1fr),5.5rem] gap-3">
                  <Input
                    label={t("settings:workTypeFormulas.fields.unitLabel")}
                    error={form.formState.errors.unitLabel?.message}
                    {...form.register("unitLabel")}
                  />
                  <Input
                    label={t("settings:workTypeFormulas.fields.unitSymbol")}
                    placeholder={t("settings:workTypeFormulas.symbolPlaceholder")}
                    error={form.formState.errors.unitSymbol?.message}
                    {...form.register("unitSymbol")}
                  />
                </div>
              ) : null}
              {!parentOnly && selectedCalculationMethod === "UNITS_PER_HOUR_BASED" ? (
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder={t("settings:workTypeFormulas.unitsPerHourPlaceholder")}
                  label={t("settings:workTypeFormulas.fields.unitsPerHour")}
                  error={form.formState.errors.unitsPerHour?.message}
                  {...unitsPerHourField}
                  onChange={(event) => {
                    const sanitized = event.currentTarget.value.replace(/[^\d.,]/g, "");
                    if (event.currentTarget.value !== sanitized) {
                      event.currentTarget.value = sanitized;
                    }
                    void unitsPerHourField.onChange(event);
                  }}
                />
              ) : null}
              {!parentOnly && selectedCalculationMethod === "UNIT_BASED" ? (
                <div className="grid grid-cols-[minmax(0,1fr),5.5rem] gap-3">
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder={t("settings:workTypeFormulas.ratePerUnitPlaceholder")}
                    label={t("settings:workTypeFormulas.fields.ratePerUnit")}
                    error={form.formState.errors.ratePerUnit?.message}
                    {...ratePerUnitField}
                    onChange={(event) => {
                      const sanitized = event.currentTarget.value.replace(/[^\d.,]/g, "");
                      if (event.currentTarget.value !== sanitized) {
                        event.currentTarget.value = sanitized;
                      }
                      void ratePerUnitField.onChange(event);
                    }}
                  />
                  <Input
                    label={t("settings:workTypeFormulas.fields.currency")}
                    maxLength={3}
                    error={form.formState.errors.currency?.message}
                    {...form.register("currency", {
                      onChange: (event) => {
                        const input = event.target as HTMLInputElement;
                        input.value = input.value.toUpperCase();
                      }
                    })}
                  />
                </div>
              ) : null}
              <label className="flex items-start gap-3 rounded-[22px] border border-white/[0.08] bg-white/[0.035] px-4 py-3 text-sm text-white/64">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-white"
                  {...form.register("teamworkEnabled")}
                />
                <span>
                  <span className="block font-semibold text-white/78">
                    {t("settings:workTypeEditor.fields.teamworkEnabled")}
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-3 rounded-[22px] border border-white/[0.08] bg-white/[0.035] px-4 py-3 text-sm text-white/64">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-white"
                  aria-label={t("settings:workTypeEditor.fields.compositeEnabled")}
                  checked={Boolean(compositeEnabled)}
                  onChange={(event) => {
                    form.setValue("compositeEnabled", event.currentTarget.checked, {
                      shouldDirty: true,
                      shouldTouch: true,
                      shouldValidate: true
                    });
                    if (event.currentTarget.checked && draftChildren.length === 0) {
                      setDraftChildren([createDraftChildWorkType()]);
                    }
                  }}
                />
                <span>
                  <span className="block font-semibold text-white/78">
                    {t("settings:workTypeEditor.fields.compositeEnabled")}
                  </span>
                </span>
              </label>
              {!isEditing && parentOnly ? (
                <DraftChildWorkTypes
                  mode={childDraftMode}
                  childrenDrafts={draftChildren.length ? draftChildren : [createDraftChildWorkType()]}
                  onChange={setDraftChildren}
                  labels={{
                    add: t("settings:workSetup.addWorkType"),
                    name: t("settings:workTypeEditor.fields.name"),
                    unitLabel: t("settings:workTypeFormulas.fields.unitLabel"),
                    unitSymbol: t("settings:workTypeFormulas.fields.unitSymbol"),
                    unitsPerHour: t("settings:workTypeFormulas.fields.unitsPerHour"),
                    ratePerUnit: t("settings:workTypeFormulas.fields.ratePerUnit"),
                    currency: t("settings:workTypeFormulas.fields.currency"),
                    defaultBreakMinutes: t("settings:workTypeFormulas.fields.defaultBreakMinutes"),
                    symbolPlaceholder: t("settings:workTypeFormulas.symbolPlaceholder"),
                    unitsPerHourPlaceholder: t("settings:workTypeFormulas.unitsPerHourPlaceholder"),
                    ratePerUnitPlaceholder: t("settings:workTypeFormulas.ratePerUnitPlaceholder")
                  }}
                />
              ) : null}
	          </div>
        </SettingsSection>

        {isEditing && compositeEnabled ? (
          <SettingsSection title={t("settings:workTypeFormulas.sectionTitle")}>
            <div className="space-y-4">
              <p className="text-sm leading-6 text-white/54">
                {t("settings:workTypeFormulas.sectionDescription")}
              </p>
              {orderedConfigurations.length ? (
                <div className="space-y-3">
                  {orderedConfigurations.map((configuration) => (
                    <button
                      key={configuration.id}
                      type="button"
                      onClick={() => openConfigurationEditDialog(configuration)}
                      className="dashboard-glass-card w-full px-5 py-5 text-left transition hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-white/24"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className={`text-[1.05rem] font-semibold tracking-[-0.04em] ${configuration.active ? "text-white" : "text-white/42"}`}>
                            {configuration.name}
                          </p>
                          <p className="mt-1 text-sm text-white/46">
                            {configurationSummary(configuration, t)}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs uppercase tracking-[0.16em] text-white/28">
                          {configuration.active ? t("settings:status.active") : t("settings:status.inactive")}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <SettingsEmptyState
                  title={t("settings:workTypeFormulas.emptyTitle")}
                  description={t("settings:workTypeFormulas.emptyDescription")}
                  actionLabel={t("settings:workSetup.addWorkType")}
                  onAction={() => openConfigurationDialog()}
                />
              )}
              {orderedConfigurations.length ? (
                <Button type="button" variant="secondary" className="w-full" onClick={() => openConfigurationDialog()}>
                  {t("settings:workSetup.addWorkType")}
                </Button>
              ) : null}
            </div>
          </SettingsSection>
        ) : null}

        <SettingsFormActions
          submitting={saveMutation.isPending}
          onDelete={isEditing ? () => setShowConfirm(true) : undefined}
          deleteLabel={isEditing ? t(`settings:workTypeEditor.${deletionMode}`) : undefined}
          deleteDisabled={deleteMutation.isPending}
        />
      </form>

      <SettingsConfirmDialog
        open={showConfirm}
        title={t(`settings:workTypeEditor.${deletionMode}Title`)}
        description={t(`settings:workTypeEditor.${deletionMode}Description`)}
        confirmLabel={t(`settings:workTypeEditor.${deletionMode}Confirm`)}
        pending={deleteMutation.isPending}
        onCancel={() => setShowConfirm(false)}
        onConfirm={() => void deleteMutation.mutateAsync()}
      />
      <WorkTypeFormulaDialog
        open={configurationDialogOpen}
        mode={selectedConfiguration ? "edit" : "create"}
        pending={
          createConfigurationMutation.isPending ||
          updateConfigurationMutation.isPending ||
          deleteConfigurationMutation.isPending
        }
        form={configurationForm}
        selectedSetupMode={selectedSetupMode ?? (workTypeQuery.data?.compositeEnabled ? null : workTypeSetupMode(workTypeQuery.data?.calculationMethod))}
        onClose={closeConfigurationDialog}
        onSubmit={(values) =>
          selectedConfiguration
            ? updateConfigurationMutation.mutateAsync({ configuration: selectedConfiguration, values })
            : createConfigurationMutation.mutateAsync(values)
        }
        onDeactivate={
          selectedConfiguration
            ? () => deleteConfigurationMutation.mutateAsync(selectedConfiguration)
            : undefined
        }
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
    </WorkTypeEditorShell>
  );
}

function WorkTypeEditorShell({
  title,
  backLabel,
  onBack,
  children
}: {
  title: string;
  backLabel: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  const backButtonRef = useRef<HTMLButtonElement | null>(null);
  const largeTitleRef = useRef<HTMLHeadingElement | null>(null);
  const [compactTitleVisible, setCompactTitleVisible] = useState(false);

  useEffect(() => {
    let frameId = 0;

    const updateCompactTitle = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        const titleRect = largeTitleRef.current?.getBoundingClientRect();
        const buttonRect = backButtonRef.current?.getBoundingClientRect();

        if (!titleRect || !buttonRect) {
          setCompactTitleVisible(false);
          return;
        }

        setCompactTitleVisible(titleRect.top <= buttonRect.top);
      });
    };

    updateCompactTitle();
    window.addEventListener("scroll", updateCompactTitle, { passive: true });
    window.addEventListener("resize", updateCompactTitle);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("scroll", updateCompactTitle);
      window.removeEventListener("resize", updateCompactTitle);
    };
  }, []);

  return (
    <div className="mx-auto w-full max-w-[560px] space-y-8 pb-10 pt-12">
      <header className="settings-sticky-header fixed inset-x-0 top-0 z-40 mx-auto flex h-[7.25rem] w-full max-w-[560px] items-start px-5 pt-2">
        <button
          ref={backButtonRef}
          type="button"
          onClick={onBack}
          aria-label={backLabel}
          className="mt-[3.25rem] flex h-10 items-center gap-1.5 rounded-md px-0 text-[1.08rem] font-bold leading-none tracking-[-0.045em] text-white transition active:scale-95 focus:outline-none focus:ring-2 focus:ring-white/24"
        >
          <ArrowLeft className="h-[1.22rem] w-[1.22rem]" aria-hidden="true" />
          <span>{backLabel}</span>
        </button>
        <div
          className={`pointer-events-none absolute left-1/2 top-[3.75rem] flex h-10 -translate-x-1/2 items-center text-[1.08rem] font-bold leading-none tracking-[-0.045em] text-white transition duration-300 ${
            compactTitleVisible ? "translate-y-0 opacity-100 delay-100" : "translate-y-1 opacity-0 delay-0"
          }`}
          aria-hidden="true"
        >
          {title}
        </div>
      </header>

      <h1
        ref={largeTitleRef}
        className={`text-[2.8rem] font-semibold leading-none tracking-[-0.08em] text-white transition duration-200 ${
          compactTitleVisible ? "-translate-y-1 opacity-0" : "translate-y-0 opacity-100 delay-75"
        }`}
      >
        {title}
      </h1>
      {children}
    </div>
  );
}

function WorkTypeInfoCard({
  icon,
  title,
  description,
  details
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  details: Array<{ label: string; value: string }>;
}) {
  return (
    <section className="dashboard-glass-card overflow-hidden rounded-[24px] px-4 py-4 sm:px-5">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-white/[0.09] text-white/78">
          {icon}
        </div>
        <div className="min-w-0">
          <h2 className="text-[1.05rem] font-semibold leading-tight tracking-normal text-white">{title}</h2>
          <p className="mt-1 text-sm leading-5 tracking-normal text-white/56">{description}</p>
        </div>
      </div>
      <dl className="mt-4 divide-y divide-white/[0.07] border-t border-white/[0.07]">
        {details.map((detail) => (
          <div key={detail.label} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3 py-3 text-sm sm:grid-cols-[7.5rem_minmax(0,1fr)]">
            <dt className="font-medium text-white/42">{detail.label}</dt>
            <dd className="leading-5 text-white/76">{detail.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function DraftChildWorkTypes({
  mode,
  childrenDrafts,
  labels,
  onChange
}: {
  mode: WorkTypeFormulaMode;
  childrenDrafts: DraftChildWorkType[];
  labels: {
    add: string;
    name: string;
    unitLabel: string;
    unitSymbol: string;
    unitsPerHour: string;
    ratePerUnit: string;
    currency: string;
    defaultBreakMinutes: string;
    symbolPlaceholder: string;
    unitsPerHourPlaceholder: string;
    ratePerUnitPlaceholder: string;
  };
  onChange: (rows: DraftChildWorkType[]) => void;
}) {
  function updateRow(id: string, patch: Partial<DraftChildWorkType>) {
    onChange(childrenDrafts.map((row) => row.id === id ? { ...row, ...patch } : row));
  }

  return (
    <div className="space-y-3">
      {childrenDrafts.map((row) => (
        <div key={row.id} className="rounded-[26px] border border-white/[0.08] bg-white/[0.035] p-4">
          <div className="space-y-3">
            {mode === "TIME_HOURLY" ? (
              <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-3">
                <Input
                  label={labels.name}
                  value={row.name}
                  onChange={(event) => updateRow(row.id, { name: event.currentTarget.value })}
                />
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  label={labels.defaultBreakMinutes}
                  value={row.defaultBreakMinutes}
                  onChange={(event) => updateRow(row.id, { defaultBreakMinutes: event.currentTarget.value })}
                />
              </div>
            ) : (
              <Input
                label={labels.name}
                value={row.name}
                onChange={(event) => updateRow(row.id, { name: event.currentTarget.value })}
              />
            )}
            {mode !== "TIME_HOURLY" && mode !== "FIXED_AMOUNT" ? (
              <div className="grid grid-cols-[minmax(0,1fr),5.5rem] gap-3">
                <Input
                  label={labels.unitLabel}
                  value={row.unitLabel}
                  onChange={(event) => updateRow(row.id, { unitLabel: event.currentTarget.value })}
                />
                <Input
                  label={labels.unitSymbol}
                  placeholder={labels.symbolPlaceholder}
                  value={row.unitSymbol}
                  onChange={(event) => updateRow(row.id, { unitSymbol: event.currentTarget.value })}
                />
              </div>
            ) : null}
            {mode === "UNITS_PER_HOUR" ? (
              <Input
                type="text"
                inputMode="decimal"
                label={labels.unitsPerHour}
                placeholder={labels.unitsPerHourPlaceholder}
                value={row.unitsPerHour}
                onChange={(event) => updateRow(row.id, { unitsPerHour: sanitizeDecimalInput(event.currentTarget.value) })}
              />
            ) : null}
            {mode === "UNITS_PER_UNIT" ? (
              <div className="grid grid-cols-[minmax(0,1fr),5.5rem] gap-3">
                <Input
                  type="text"
                  inputMode="decimal"
                  label={labels.ratePerUnit}
                  placeholder={labels.ratePerUnitPlaceholder}
                  value={row.ratePerUnit}
                  onChange={(event) => updateRow(row.id, { ratePerUnit: sanitizeDecimalInput(event.currentTarget.value) })}
                />
                <Input
                  label={labels.currency}
                  maxLength={3}
                  value={row.currency}
                  onChange={(event) => updateRow(row.id, { currency: event.currentTarget.value.toUpperCase() })}
                />
              </div>
            ) : null}
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="secondary"
        className="w-full"
        onClick={() => onChange([...childrenDrafts, createDraftChildWorkType()])}
      >
        {labels.add}
      </Button>
    </div>
  );
}

function WorkTypeFormulaDialog({
  open,
  mode,
  pending,
  form,
  selectedSetupMode,
  onClose,
  onSubmit,
  onDeactivate
}: {
  open: boolean;
  mode: "create" | "edit";
  pending: boolean;
  form: ReturnType<typeof useForm<ConfigurationDialogInput, undefined, ConfigurationDialogValues>>;
  selectedSetupMode: WorkTypeFormulaMode | null;
  onClose: () => void;
  onSubmit: (values: ConfigurationDialogValues) => Promise<unknown>;
  onDeactivate?: () => Promise<unknown>;
}) {
  const { t } = useTranslation(["settings", "common"]);
  const modeField = form.watch("calculationMode");
  const unitsPerHourField = form.register("unitsPerHour");
  const ratePerUnitField = form.register("ratePerUnit");

  if (!open) {
    return null;
  }

  const availableModes = selectedSetupMode
    ? [selectedSetupMode]
    : ["TIME_HOURLY", "UNITS_PER_HOUR", "UNITS_PER_UNIT", "FIXED_AMOUNT"] as const;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-[calc(env(safe-area-inset-top)+1.5rem)] backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="work-type-configuration-dialog-title"
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
            form.setError("root", { message: t("settings:workTypeFormulas.validation.fixErrors") });
          }
        )}
      >
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 id="work-type-configuration-dialog-title" className="text-xl font-semibold tracking-[-0.06em] text-white">
            {mode === "edit" ? t("settings:workTypeFormulas.editTitle") : t("settings:workTypeFormulas.addTitle")}
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
            label={t("settings:workTypeFormulas.fields.name")}
            error={form.formState.errors.name?.message}
            {...form.register("name")}
          />
          {availableModes.length > 1 ? (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-white/78">
                {t("settings:workTypeFormulas.fields.calculationMode")}
              </legend>
              <div className="grid gap-2">
                {availableModes.map((option) => {
                  const meta = configurationModeMeta(option, t);
                  const selected = modeField === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={selected}
                      disabled={mode === "edit"}
                      onClick={() => form.setValue("calculationMode", option, { shouldDirty: true, shouldTouch: true, shouldValidate: true })}
                      className={[
                        "rounded-[20px] border px-4 py-3 text-left text-sm transition disabled:opacity-60",
                        selected
                          ? "border-white bg-white text-black"
                          : "border-white/[0.1] bg-white/[0.045] text-white/62 hover:bg-white/[0.08] hover:text-white"
                      ].join(" ")}
                    >
                      <span className="block font-semibold">{meta.label}</span>
                      <span className="mt-1 block opacity-70">{meta.description}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ) : null}
          {modeField !== "TIME_HOURLY" && modeField !== "FIXED_AMOUNT" ? (
            <div className="grid grid-cols-[minmax(0,1fr),5.5rem] gap-3">
              <Input
                label={t("settings:workTypeFormulas.fields.unitLabel")}
                error={form.formState.errors.unitLabel?.message}
                {...form.register("unitLabel")}
              />
              <Input
                label={t("settings:workTypeFormulas.fields.unitSymbol")}
                placeholder={t("settings:workTypeFormulas.symbolPlaceholder")}
                error={form.formState.errors.unitSymbol?.message}
                {...form.register("unitSymbol")}
              />
            </div>
          ) : null}
          {modeField === "UNITS_PER_HOUR" ? (
            <Input
              type="text"
              inputMode="decimal"
              placeholder={t("settings:workTypeFormulas.unitsPerHourPlaceholder")}
              label={t("settings:workTypeFormulas.fields.unitsPerHour")}
              error={form.formState.errors.unitsPerHour?.message}
              {...unitsPerHourField}
              onChange={(event) => {
                const sanitized = event.currentTarget.value.replace(/[^\d.,]/g, "");
                if (event.currentTarget.value !== sanitized) {
                  event.currentTarget.value = sanitized;
                }
                void unitsPerHourField.onChange(event);
              }}
            />
          ) : null}
          {modeField === "UNITS_PER_UNIT" ? (
            <div className="grid grid-cols-[minmax(0,1fr),5.5rem] gap-3">
              <Input
                type="text"
                inputMode="decimal"
                placeholder={t("settings:workTypeFormulas.ratePerUnitPlaceholder")}
                label={t("settings:workTypeFormulas.fields.ratePerUnit")}
                error={form.formState.errors.ratePerUnit?.message}
                {...ratePerUnitField}
                onChange={(event) => {
                  const sanitized = event.currentTarget.value.replace(/[^\d.,]/g, "");
                  if (event.currentTarget.value !== sanitized) {
                    event.currentTarget.value = sanitized;
                  }
                  void ratePerUnitField.onChange(event);
                }}
              />
              <Input
                label={t("settings:workTypeFormulas.fields.currency")}
                maxLength={3}
                error={form.formState.errors.currency?.message}
                {...form.register("currency", {
                  onChange: (event) => {
                    const input = event.target as HTMLInputElement;
                    input.value = input.value.toUpperCase();
                  }
                })}
              />
            </div>
          ) : null}
          {modeField === "TIME_HOURLY" ? (
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              label={t("settings:workTypeFormulas.fields.defaultBreakMinutes")}
              error={form.formState.errors.defaultBreakMinutes?.message}
              {...form.register("defaultBreakMinutes")}
            />
          ) : null}
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
                {t("settings:workTypeFormulas.deactivate")}
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

function normalizeOptionalNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(parseDecimalInput(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function sanitizeDecimalInput(value: string) {
  return value.replace(/[^\d.,]/g, "");
}

function workTypeEditorSectionTitle(
  calculationMethod: FormValues["calculationMethod"],
  t: ReturnType<typeof useTranslation<["settings", "common", "records", "errors"]>>["t"]
) {
  if (calculationMethod === "TIME_BASED") {
    return t("settings:workTypeEditor.modes.timeTitle");
  }
  if (calculationMethod === "UNITS_PER_HOUR_BASED") {
    return t("settings:workTypeEditor.modes.unitsPerHourTitle");
  }
  if (calculationMethod === "UNIT_BASED") {
    return t("settings:workTypeEditor.modes.perUnitTitle");
  }
  return t("settings:workTypeEditor.modes.fixedTitle");
}

function createDraftChildWorkType(): DraftChildWorkType {
  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    name: "",
    unitLabel: "",
    unitSymbol: "",
    unitsPerHour: "",
    ratePerUnit: "",
    currency: "EUR",
    defaultBreakMinutes: "30"
  };
}

function hasDraftChildContent(child: DraftChildWorkType) {
  return [
    child.name,
    child.unitLabel,
    child.unitSymbol,
    child.unitsPerHour,
    child.ratePerUnit
  ].some((value) => value.trim().length > 0);
}

function workTypeSetupMode(calculationMethod?: FormValues["calculationMethod"] | null): WorkTypeFormulaMode | null {
  if (calculationMethod === "TIME_BASED") return "TIME_HOURLY";
  if (calculationMethod === "UNITS_PER_HOUR_BASED") return "UNITS_PER_HOUR";
  if (calculationMethod === "UNIT_BASED") return "UNITS_PER_UNIT";
  if (calculationMethod === "FIXED_PRICE_BASED") return "FIXED_AMOUNT";
  return null;
}

function parseSetupMode(value: string | null): WorkTypeFormulaMode | null {
  if (
    value === "TIME_HOURLY" ||
    value === "UNITS_PER_HOUR" ||
    value === "UNITS_PER_UNIT" ||
    value === "FIXED_AMOUNT"
  ) {
    return value;
  }
  return null;
}

function buildDraftChildWorkTypePayload(
  child: DraftChildWorkType,
  mode: WorkTypeFormulaMode,
  options: { parentId: string; color: string; teamworkEnabled: boolean; displayOrder: number; active: boolean }
) {
  return buildChildWorkTypePayload(
    {
      name: child.name,
      calculationMode: mode,
      unitLabel: child.unitLabel,
      unitSymbol: child.unitSymbol,
      unitsPerHour: child.unitsPerHour ? Number(child.unitsPerHour.replace(",", ".")) : undefined,
      ratePerUnit: child.ratePerUnit ? Number(child.ratePerUnit.replace(",", ".")) : undefined,
      currency: child.currency,
      defaultBreakMinutes: child.defaultBreakMinutes ? Number(child.defaultBreakMinutes) : 0
    },
    options
  );
}

function workTypeToConfiguration(workType: WorkType): WorkTypeFormula {
  return {
    id: workType.id,
    workTypeId: workType.parentId ?? "",
    name: workType.name,
    calculationMode: workTypeSetupMode(workType.calculationMethod) ?? "TIME_HOURLY",
    unitLabel: workType.unitLabel ?? null,
    unitSymbol: workType.unitSymbol ?? null,
    unitsPerHour: workType.unitsPerHour ?? null,
    ratePerUnit: workType.ratePerUnit ?? null,
    currency: workType.currency ?? null,
    defaultBreakMinutes: workType.defaultBreakMinutes ?? null,
    active: workType.active,
    displayOrder: workType.displayOrder,
    createdAt: "",
    updatedAt: ""
  };
}

function buildWorkTypePayload(
  values: FormValues,
  options: { color: string; displayOrder?: number; active: boolean }
) {
  const unitLabel = values.unitLabel?.trim();
  const unitSymbol = values.unitSymbol?.trim();
  const currency = values.currency?.trim();
  const parentOnly = Boolean(values.compositeEnabled);
  return {
    name: values.name,
    calculationMethod: values.calculationMethod,
    compensationMethod: values.calculationMethod === "UNIT_BASED" ? "PER_UNIT" as const : "HOURLY" as const,
    unitLabel:
      parentOnly || values.calculationMethod === "TIME_BASED" || values.calculationMethod === "FIXED_PRICE_BASED"
        ? null
        : unitLabel || null,
    unitSymbol:
      parentOnly || values.calculationMethod === "TIME_BASED" || values.calculationMethod === "FIXED_PRICE_BASED"
        ? null
        : unitSymbol || null,
    unitsPerHour:
      !parentOnly && values.calculationMethod === "UNITS_PER_HOUR_BASED"
        ? normalizeOptionalNumber(values.unitsPerHour)
        : null,
    ratePerUnit:
      !parentOnly && values.calculationMethod === "UNIT_BASED"
        ? normalizeOptionalNumber(values.ratePerUnit)
        : null,
    currency:
      !parentOnly && values.calculationMethod === "UNIT_BASED" && currency
        ? currency.toUpperCase()
        : null,
    teamworkEnabled: values.teamworkEnabled ?? false,
    compositeEnabled: values.compositeEnabled ?? false,
    color: options.color,
    icon: null,
    defaultBreakMinutes:
      !parentOnly && values.calculationMethod === "TIME_BASED"
        ? values.defaultBreakMinutes ?? 0
        : null,
    displayOrder: options.displayOrder ?? null,
    active: options.active
  };
}

function buildChildWorkTypePayload(
  values: ConfigurationDialogValues,
  options: { parentId: string; color: string; teamworkEnabled?: boolean; displayOrder?: number | null; active: boolean }
) {
  const calculationMethod =
    values.calculationMode === "TIME_HOURLY"
      ? "TIME_BASED"
      : values.calculationMode === "UNITS_PER_HOUR"
        ? "UNITS_PER_HOUR_BASED"
        : values.calculationMode === "UNITS_PER_UNIT"
          ? "UNIT_BASED"
          : "FIXED_PRICE_BASED";
  return {
    ...buildWorkTypePayload(
    {
      name: values.name,
      calculationMethod,
      compensationMethod: calculationMethod === "UNIT_BASED" ? "PER_UNIT" : "HOURLY",
      unitLabel: values.unitLabel ?? "",
      unitSymbol: values.unitSymbol ?? "",
      unitsPerHour: values.unitsPerHour,
      ratePerUnit: values.ratePerUnit,
      currency: values.currency ?? "EUR",
      teamworkEnabled: options.teamworkEnabled ?? false,
      compositeEnabled: false,
      color: options.color,
      defaultBreakMinutes: values.defaultBreakMinutes,
      active: options.active
    },
    {
      color: options.color,
      displayOrder: options.displayOrder ?? undefined,
      active: options.active
    }
    ),
    parentId: options.parentId
  };
}

function setupModeOptions(t: ReturnType<typeof useTranslation<["settings", "common", "records", "errors"]>>["t"]) {
  return [
    {
      mode: "TIME_HOURLY" as const,
      calculationMethod: "TIME_BASED" as const,
      compensationMethod: "HOURLY" as const,
      title: t("settings:workTypeEditor.modes.timeTitle"),
      description: t("settings:workTypeEditor.modes.timeDescription"),
      formula: t("settings:workTypeEditor.modes.timeFormula"),
      suggestedName: t("settings:workTypeEditor.modes.timeSuggestedName"),
      icon: <Clock3 className="h-5 w-5" aria-hidden="true" />
    },
    {
      mode: "UNITS_PER_HOUR" as const,
      calculationMethod: "UNITS_PER_HOUR_BASED" as const,
      compensationMethod: "HOURLY" as const,
      title: t("settings:workTypeEditor.modes.unitsPerHourTitle"),
      description: t("settings:workTypeEditor.modes.unitsPerHourDescription"),
      formula: t("settings:workTypeEditor.modes.unitsPerHourFormula"),
      suggestedName: t("settings:workTypeEditor.modes.unitsPerHourSuggestedName"),
      icon: <Ruler className="h-5 w-5" aria-hidden="true" />
    },
    {
      mode: "UNITS_PER_UNIT" as const,
      calculationMethod: "UNIT_BASED" as const,
      compensationMethod: "PER_UNIT" as const,
      title: t("settings:workTypeEditor.modes.perUnitTitle"),
      description: t("settings:workTypeEditor.modes.perUnitDescription"),
      formula: t("settings:workTypeEditor.modes.perUnitFormula"),
      suggestedName: t("settings:workTypeEditor.modes.perUnitSuggestedName"),
      icon: <Coins className="h-5 w-5" aria-hidden="true" />
    },
    {
      mode: "FIXED_AMOUNT" as const,
      calculationMethod: "FIXED_PRICE_BASED" as const,
      compensationMethod: "HOURLY" as const,
      title: t("settings:workTypeEditor.modes.fixedTitle"),
      description: t("settings:workTypeEditor.modes.fixedDescription"),
      formula: t("settings:workTypeEditor.modes.fixedFormula"),
      suggestedName: t("settings:workTypeEditor.modes.fixedSuggestedName"),
      icon: <Coins className="h-5 w-5" aria-hidden="true" />
    }
  ];
}

function configurationModeMeta(
  mode: WorkTypeFormulaMode,
  t: ReturnType<typeof useTranslation<["settings", "common"]>>["t"]
) {
  if (mode === "TIME_HOURLY") {
    return {
      label: t("settings:workTypeFormulas.modes.timeTitle"),
      description: t("settings:workTypeFormulas.modes.timeDescription")
    };
  }
  if (mode === "UNITS_PER_HOUR") {
    return {
      label: t("settings:workTypeFormulas.modes.unitsPerHourTitle"),
      description: t("settings:workTypeFormulas.modes.unitsPerHourDescription")
    };
  }
  if (mode === "FIXED_AMOUNT") {
    return {
      label: t("settings:workTypeFormulas.modes.fixedTitle"),
      description: t("settings:workTypeFormulas.modes.fixedDescription")
    };
  }
  return {
    label: t("settings:workTypeFormulas.modes.perUnitTitle"),
    description: t("settings:workTypeFormulas.modes.perUnitDescription")
  };
}

function configurationSummary(
  configuration: WorkTypeFormula,
  t: ReturnType<typeof useTranslation<["settings", "common", "records", "errors"]>>["t"]
) {
  const unit = configuration.unitSymbol ?? configuration.unitLabel ?? configuration.name;
  if (configuration.calculationMode === "TIME_HOURLY") {
    return t("settings:workTypeFormulas.summary.time", {
      breakMinutes: configuration.defaultBreakMinutes ?? 0
    });
  }
  if (configuration.calculationMode === "UNITS_PER_HOUR") {
    return t("settings:workTypeFormulas.summary.unitsPerHour", {
      unit,
      unitsPerHour: configuration.unitsPerHour ?? "-"
    });
  }
  if (configuration.calculationMode === "FIXED_AMOUNT") {
    return t("settings:workTypeFormulas.summary.fixed");
  }
  return t("settings:workTypeFormulas.summary.perUnit", {
    unit,
    rate: configuration.ratePerUnit ?? "-",
    currency: configuration.currency ?? ""
  });
}

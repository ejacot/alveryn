import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { getApiError } from "../api/api-errors";
import { queryKeys } from "../api/query-keys";
import {
  createWorkType,
  deleteWorkType,
  getWorkType,
  listUnitTypes,
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

function createWorkTypeSchema(t: (key: string) => string) {
  return z.object({
    name: z.string().trim().min(1, t("workTypeEditor.validation.nameRequired")).max(100, t("workTypeEditor.validation.nameTooLong")),
    calculationMethod: z.enum(["TIME_BASED", "UNIT_BASED"]),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, t("workTypeEditor.validation.color")),
    icon: z.string().max(100).optional(),
    defaultBreakMinutes: z.union([z.literal(""), z.coerce.number().min(0)]),
    displayOrder: z.coerce.number().min(0),
    active: z.boolean()
  });
}

type Schema = ReturnType<typeof createWorkTypeSchema>;
type FormValues = z.infer<Schema>;
type FormInput = z.input<Schema>;

const palette = ["#FFFFFF", "#D4D4D8", "#A1A1AA", "#71717A", "#52525B", "#3F3F46"];

export function WorkTypeEditorPage() {
  const navigate = useNavigate();
  const { t } = useTranslation(["settings", "common", "entries"]);
  const queryClient = useQueryClient();
  const { workTypeId } = useParams();
  const isEditing = Boolean(workTypeId);
  const [showConfirm, setShowConfirm] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const safeBack = useSafeBackNavigation({ fallback: "/settings/work-types" });
  const schema = useMemo(() => createWorkTypeSchema((key) => t(`settings:${key}`)), [t]);

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
      icon: "",
      defaultBreakMinutes: 30,
      displayOrder: 0,
      active: true
    }
  });

  const calculationMethod = form.watch("calculationMethod");

  useEffect(() => {
    if (!workTypeQuery.data) return;
    form.reset({
      name: workTypeQuery.data.name,
      calculationMethod: workTypeQuery.data.calculationMethod,
      color: workTypeQuery.data.color,
      icon: workTypeQuery.data.icon ?? "",
      defaultBreakMinutes: workTypeQuery.data.defaultBreakMinutes ?? "",
      displayOrder: workTypeQuery.data.displayOrder,
      active: workTypeQuery.data.active
    });
  }, [form, workTypeQuery.data]);

  async function afterSuccess(targetId?: string, calculationMethod?: FormValues["calculationMethod"]) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.workTypes.all() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.unitTypes.all() })
    ]);
    if (targetId && (isEditing || calculationMethod === "UNIT_BASED")) {
      navigate(`/settings/work-types/${targetId}`);
      return;
    }
    navigate("/settings/work-types");
  }

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = {
        name: values.name.trim(),
        calculationMethod: values.calculationMethod,
        color: values.color,
        icon: values.icon?.trim() ? values.icon.trim() : null,
        defaultBreakMinutes:
          values.calculationMethod === "TIME_BASED" && values.defaultBreakMinutes !== ""
            ? Number(values.defaultBreakMinutes)
            : null,
        displayOrder: values.displayOrder,
        active: values.active
      };

      return isEditing
        ? updateWorkType(workTypeId!, payload)
        : createWorkType({
            name: payload.name,
            calculationMethod: payload.calculationMethod,
            color: payload.color,
            icon: payload.icon,
            defaultBreakMinutes: payload.defaultBreakMinutes,
            displayOrder: payload.displayOrder
          });
    },
    onSuccess: async (workType) => {
      setSuccessMessage(isEditing ? t("settings:workTypeEditor.updated") : t("settings:workTypeEditor.created"));
      await afterSuccess(workType.id, workType.calculationMethod);
    },
    onError: (error) => {
      const apiError = getApiError(error);
      Object.entries(apiError.fieldErrors).forEach(([field, message]) => {
        form.setError(field as keyof FormValues, { message });
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

  return (
    <div className="space-y-8 pb-10">
      <SettingsPageHeader
        title={isEditing ? t("settings:workTypeEditor.editTitle") : t("settings:workTypeEditor.addTitle")}
        description={t("settings:workTypeEditor.editorDescription")}
        fallbackHref="/settings/work-types"
        onBack={() => confirmOrRun(safeBack)}
      />
      <form
        className="space-y-6"
        onSubmit={form.handleSubmit(async (values) => {
          try {
            await saveMutation.mutateAsync(values);
          } catch {
            // Mutation state renders field and global API errors without leaving the form.
          }
        })}
      >
        <SettingsSection title={t("settings:workTypeEditor.coreSettings")}>
          <div className="space-y-4">
            <Input label={t("settings:workTypeEditor.fields.name")} error={form.formState.errors.name?.message} {...form.register("name")} />
            <Select label={t("settings:workTypeEditor.fields.calculationMethod")} error={form.formState.errors.calculationMethod?.message} {...form.register("calculationMethod")}>
              <option value="TIME_BASED">{t("entries:workTypePicker.timeBased")}</option>
              <option value="UNIT_BASED">{t("entries:workTypePicker.unitBased")}</option>
            </Select>
            <Input label={t("settings:workTypeEditor.fields.color")} error={form.formState.errors.color?.message} {...form.register("color")} />
            <div className="flex flex-wrap gap-2">
              {palette.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => form.setValue("color", color, { shouldValidate: true })}
                  className="h-9 w-9 rounded-full border border-white/[0.08]"
                  style={{ backgroundColor: color }}
                  aria-label={t("settings:workTypeEditor.chooseColor", { color })}
                />
              ))}
            </div>
            <Input label={t("settings:workTypeEditor.fields.icon")} error={form.formState.errors.icon?.message} {...form.register("icon")} />
            {calculationMethod === "TIME_BASED" ? (
              <Input
                type="number"
                min={0}
                label={t("settings:workTypeEditor.fields.defaultBreakMinutes")}
                error={form.formState.errors.defaultBreakMinutes?.message as string | undefined}
                {...form.register("defaultBreakMinutes")}
              />
            ) : null}
            <Input type="number" min={0} label={t("settings:workTypeEditor.fields.displayOrder")} error={form.formState.errors.displayOrder?.message} {...form.register("displayOrder")} />
            {isEditing ? (
              <Select label={t("settings:workTypeEditor.fields.status")} error={form.formState.errors.active?.message as string | undefined} {...form.register("active", { setValueAs: (value) => value === "true" || value === true })}>
                <option value="true">{t("settings:status.active")}</option>
                <option value="false">{t("settings:status.inactive")}</option>
              </Select>
            ) : null}
          </div>
        </SettingsSection>

        {isEditing && workTypeQuery.data?.calculationMethod === "UNIT_BASED" ? (
          <SettingsSection
            title={t("settings:unitTypes.sectionTitle")}
            description={t("settings:unitTypes.explanation")}
          >
            <div className="space-y-4">
              <Button type="button" variant="secondary" className="w-full" onClick={() => navigate(`/settings/work-types/${workTypeId}/unit-types/new`)}>
                {t("settings:unitTypes.add")}
              </Button>
              {unitTypesQuery.data?.length ? (
                <div className="space-y-3">
                  {unitTypesQuery.data.map((unit) => (
                    <button
                      key={unit.id}
                      type="button"
                      onClick={() => navigate(`/settings/work-types/${workTypeId}/unit-types/${unit.id}`)}
                      className="w-full rounded-[24px] border border-white/[0.05] bg-white/[0.03] px-4 py-4 text-left transition hover:bg-white/[0.04]"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className={`text-[1rem] font-medium ${unit.active ? "text-white" : "text-white/44"}`}>
                            {unit.name}
                          </p>
                          <p className="mt-1 text-sm text-white/46">
                            {t("settings:unitTypes.rateLine", { value: unit.unitsPerHour })}
                          </p>
                        </div>
                        <span className="text-xs uppercase tracking-[0.16em] text-white/28">
                          {unit.active ? t("settings:status.active") : t("settings:status.inactive")}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <SettingsEmptyState
                  title={t("settings:unitTypes.emptyTitle")}
                  description={t("settings:unitTypes.emptyDescription")}
                  actionLabel={t("settings:unitTypes.add")}
                  onAction={() => navigate(`/settings/work-types/${workTypeId}/unit-types/new`)}
                />
              )}
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
        {saveMutation.error ? (
          <p className="text-sm text-red-300">
            {formatWorkTypeError(
              getApiError(saveMutation.error).message,
              t("settings:workTypeEditor.savedEntriesError")
            )}
          </p>
        ) : null}
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
      {dialog}
    </div>
  );
}

function formatWorkTypeError(message: string, savedEntriesMessage?: string) {
  if (message.toLowerCase().includes("saved entries")) {
    return savedEntriesMessage ?? message;
  }
  return message;
}

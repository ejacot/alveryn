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
  createUnitType,
  deleteUnitType,
  getUnitType,
  updateUnitType
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

function parseDecimalInput(value: unknown) {
  if (typeof value === "string") {
    const normalized = value.trim().replace(",", ".");
    return normalized === "" ? Number.NaN : Number(normalized);
  }
  return value;
}

function createUnitTypeSchema(t: (key: string) => string) {
  return z.object({
    name: z.string().trim().min(1, t("unitTypes.validation.nameRequired")).max(100, t("unitTypes.validation.nameTooLong")),
    unitsPerHour: z.preprocess(
      parseDecimalInput,
      z.number({ error: t("unitTypes.validation.unitsPerHour") }).gt(0, t("unitTypes.validation.unitsPerHour"))
    ),
    displayOrder: z.coerce.number().min(0).optional().default(0),
    active: z.boolean().optional().default(true)
  });
}

type Schema = ReturnType<typeof createUnitTypeSchema>;
type FormValues = z.infer<Schema>;
type FormInput = z.input<Schema>;

export function UnitTypeEditorPage() {
  const navigate = useNavigate();
  const { t } = useTranslation("settings");
  const queryClient = useQueryClient();
  const { workTypeId, unitTypeId } = useParams();
  const isEditing = Boolean(unitTypeId);
  const [showConfirm, setShowConfirm] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const fallbackRoute = workTypeId ? `/settings/work-types/${workTypeId}` : "/settings/work-types";
  const safeBack = useSafeBackNavigation({ fallback: fallbackRoute });
  const schema = useMemo(() => createUnitTypeSchema((key) => t(key)), [t]);

  const unitTypeQuery = useQuery({
    queryKey:
      workTypeId && unitTypeId
        ? queryKeys.unitTypes.detail(workTypeId, unitTypeId)
        : queryKeys.workTypes.all(),
    queryFn: () => getUnitType(workTypeId!, unitTypeId!),
    enabled: Boolean(workTypeId && unitTypeId)
  });

  const form = useForm<FormInput, undefined, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      unitsPerHour: "",
      displayOrder: 0,
      active: true
    }
  });

  useEffect(() => {
    if (!unitTypeQuery.data) return;
    form.reset({
      name: unitTypeQuery.data.name,
      unitsPerHour: Number(unitTypeQuery.data.unitsPerHour),
      displayOrder: unitTypeQuery.data.displayOrder,
      active: unitTypeQuery.data.active
    });
  }, [form, unitTypeQuery.data]);

  useEffect(() => {
    if (isEditing) return;
    form.reset({
      name: "",
      unitsPerHour: "",
      displayOrder: 0,
      active: true
    });
  }, [form, isEditing]);

  async function afterSuccess() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.unitTypes.list(workTypeId!) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.unitTypes.all() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.workTypes.all() })
    ]);
    navigate(`/settings/work-types/${workTypeId}`, { replace: true });
  }

  const saveMutation = useMutation({
    mutationFn: (values: FormValues) => {
      if (isEditing) {
        return updateUnitType(workTypeId!, unitTypeId!, values);
      }
      return createUnitType(workTypeId!, {
        name: values.name,
        unitsPerHour: values.unitsPerHour,
        active: values.active
      });
    },
    onSuccess: async () => {
      setSuccessMessage(isEditing ? t("unitTypes.updated") : t("unitTypes.created"));
      await afterSuccess();
    },
    onError: (error) => {
      const apiError = getApiError(error);
      Object.entries(apiError.fieldErrors).forEach(([field, message]) => {
        form.setError(field as keyof FormValues, { message });
      });
      form.setError("root", { message: apiError.message });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteUnitType(workTypeId!, unitTypeId!),
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

  if (unitTypeQuery.isLoading) {
    return <SettingsPageSkeleton />;
  }

  if (unitTypeQuery.error) {
    return <ScreenMessage title={t("unitTypes.unavailableTitle")} description={getApiError(unitTypeQuery.error).message} />;
  }

  const unitsPerHourField = form.register("unitsPerHour");

  return (
    <div className="space-y-8 pb-10">
      <SettingsPageHeader
        title={isEditing ? t("unitTypes.editTitle") : t("unitTypes.addTitle")}
        fallbackHref={fallbackRoute}
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
              // Mutation state renders the API error and keeps the user on the form.
            }
          },
          () => {
            form.setError("root", {
              message: t("unitTypes.validation.fixErrors")
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
        <SettingsSection title={t("unitTypes.settingsTitle")}>
          <div className="space-y-4">
            <Input label={t("unitTypes.fields.name")} error={form.formState.errors.name?.message} {...form.register("name")} />
            <Input
              type="text"
              inputMode="decimal"
              placeholder={t("unitTypes.unitsPerHourPlaceholder")}
              label={t("unitTypes.fields.unitsPerHour")}
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
            {isEditing ? (
              <Select label={t("unitTypes.fields.status")} error={form.formState.errors.active?.message as string | undefined} {...form.register("active", { setValueAs: (value) => value === "true" || value === true })}>
                <option value="true">{t("status.active")}</option>
                <option value="false">{t("status.inactive")}</option>
              </Select>
            ) : null}
          </div>
        </SettingsSection>

        <SettingsFormActions
          submitting={saveMutation.isPending}
          successMessage={successMessage}
          onDelete={isEditing ? () => setShowConfirm(true) : undefined}
          deleteLabel={isEditing ? t("unitTypes.deactivate") : undefined}
          deleteDisabled={deleteMutation.isPending}
        />
      </form>

      <SettingsConfirmDialog
        open={showConfirm}
        title={t("unitTypes.deactivateTitle")}
        description={t("unitTypes.deactivateDescription")}
        confirmLabel={t("unitTypes.deactivateConfirm")}
        pending={deleteMutation.isPending}
        onCancel={() => setShowConfirm(false)}
        onConfirm={() => void deleteMutation.mutateAsync()}
      />
      {dialog}
    </div>
  );
}

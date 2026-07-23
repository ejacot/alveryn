import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Plus } from "lucide-react";
import type { TFunction } from "i18next";
import { useEffect, useMemo, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { z } from "zod";
import { getApiError } from "../api/api-errors";
import {
  createAbsenceType,
  deleteAbsenceType,
  listAbsenceTypes,
  updateAbsenceType,
  type AbsenceTypePayload
} from "../api/endpoints";
import { queryKeys } from "../api/query-keys";
import { SettingsConfirmDialog } from "../components/settings/settings-confirm-dialog";
import { SettingsSuccessMessage } from "../components/settings/settings-form-actions";
import { SettingsEmptyState } from "../components/settings/settings-empty-state";
import { SettingsPageSkeleton } from "../components/settings/settings-page-skeleton";
import { SettingsNavigationHeader } from "../components/settings/settings-navigation-header";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { LockedModalViewport } from "../components/ui/locked-modal-viewport";
import { ModalPanel } from "../components/ui/modal-panel";
import { ModalActions } from "../components/ui/modal-actions";
import { Button } from "../components/ui/button";
import { ScreenMessage } from "../components/ui/screen-message";
import { useSafeBackNavigation } from "../hooks/use-safe-back-navigation";
import { useUnsavedChangesGuard } from "../hooks/use-unsaved-changes-guard";
import type { AbsenceTypeSetting } from "../types/absence";

function decimalHours(value: unknown) {
  if (typeof value === "string") {
    const normalized = value.trim().replace(",", ".");
    return normalized === "" ? 0 : Number(normalized);
  }
  return value;
}

const schema = z.object({
  name: z.string().trim().min(1, "Required").max(80, "Too long"),
  paid: z.boolean(),
  paidHours: z.preprocess(decimalHours, z.number().min(0).max(24)),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Use #RRGGBB"),
  active: z.boolean(),
  displayOrder: z.coerce.number().int().min(0).max(999)
});

type FormValues = z.infer<typeof schema>;
type FormInput = z.input<typeof schema>;

export function SettingsAbsencePage() {
  const { t } = useTranslation(["settings", "common"]);
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const employmentId = searchParams.get("employmentId");
  const [editing, setEditing] = useState<AbsenceTypeSetting | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const safeBack = useSafeBackNavigation({ fallback: employmentId ? `/settings/employment/${employmentId}` : "/profile" });

  const absenceTypesQuery = useQuery({
    queryKey: queryKeys.absenceTypes.list(false),
    queryFn: () => listAbsenceTypes(false)
  });

  const absenceTypes = useMemo(
    () => [...(absenceTypesQuery.data ?? [])].sort((left, right) => left.displayOrder - right.displayOrder || left.name.localeCompare(right.name)),
    [absenceTypesQuery.data]
  );

  const form = useForm<FormInput, undefined, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toFormValues(null, absenceTypes.length)
  });

  useEffect(() => {
    form.reset(toFormValues(editing, absenceTypes.length));
  }, [absenceTypes.length, editing, form]);

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = toPayload(values);
      return editing ? updateAbsenceType(editing.id, payload) : createAbsenceType(payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.absenceTypes.all() });
      setEditing(null);
      setEditorOpen(false);
      form.reset(toFormValues(null, absenceTypes.length + 1));
      setSuccessMessage(t("settings:absenceSettings.saved"));
    },
    onError: (error) => {
      const apiError = getApiError(error);
      Object.entries(apiError.fieldErrors).forEach(([field, message]) => {
        form.setError(field as keyof FormValues, { message });
      });
    }
  });

  const removeMutation = useMutation({
    mutationFn: ({ id }: { id: string; deletable: boolean }) => deleteAbsenceType(id),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.absenceTypes.all() });
      setRemoveDialogOpen(false);
      setEditorOpen(false);
      setEditing(null);
      form.reset(toFormValues(null, absenceTypes.length));
      setSuccessMessage(t(variables.deletable ? "settings:absenceSettings.deleted" : "settings:absenceSettings.deactivated"));
    }
  });

  const { confirmOrRun, dialog } = useUnsavedChangesGuard({
    isDirty: editorOpen && form.formState.isDirty && !saveMutation.isPending
  });

  if (absenceTypesQuery.isLoading) {
    return <SettingsPageSkeleton />;
  }

  if (absenceTypesQuery.error) {
    return <ScreenMessage title={t("settings:absenceSettings.title")} description={getApiError(absenceTypesQuery.error).message} />;
  }

  const title = t("settings:absenceSettings.title");

  function openCreate() {
    setSuccessMessage(null);
    setEditing(null);
    form.reset(toFormValues(null, absenceTypes.length));
    setEditorOpen(true);
  }

  function openEdit(type: AbsenceTypeSetting) {
    setSuccessMessage(null);
    setEditing(type);
    form.reset(toFormValues(type, absenceTypes.length));
    setEditorOpen(true);
  }

  function closeEditor() {
    confirmOrRun(() => {
      setRemoveDialogOpen(false);
      setEditorOpen(false);
      setEditing(null);
      form.reset(toFormValues(null, absenceTypes.length));
    });
  }

  return (
    <div className="mx-auto w-full max-w-[560px] space-y-6 pb-10 pt-8">
      <SettingsNavigationHeader
        title={title}
        backLabel={t("common:actions.back")}
        onBack={safeBack}
        action={absenceTypes.length ? {
          label: t("settings:absenceSettings.addType"),
          icon: <Plus className="h-5 w-5" aria-hidden="true" />,
          onClick: openCreate
        } : undefined}
      />

      <SettingsSuccessMessage message={!editorOpen ? successMessage : null} />
      <p className="text-sm leading-6 text-white/46">{t("settings:pageInfo.absences.description")}</p>

      <section className="space-y-4">
        {absenceTypes.length ? absenceTypes.map((type) => (
          <Card
            as="button"
            type="button"
            key={type.id}
            onClick={() => openEdit(type)}
            className="flex min-h-[5.25rem] w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-white/24 focus:ring-inset"
          >
            <span className="min-w-0 flex-1">
              <span className={`font-name block truncate text-[1.05rem] font-semibold tracking-[-0.04em] ${type.active ? "text-white" : "text-white/42"}`}>
                {type.name}
              </span>
              <span className="mt-1 block truncate text-sm text-white/48">
                {type.paid
                  ? t("settings:absenceSettings.paidSummary", { hours: formatPaidHours(type.paidMinutesPerDay) })
                  : t("settings:absenceSettings.unpaidSummary")}
                {!type.active ? ` · ${t("settings:status.inactive")}` : ""}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-white/24" aria-hidden="true" />
          </Card>
        )) : (
          <SettingsEmptyState
            title={t("settings:absenceSettings.emptyTitle")}
            description={t("settings:absenceSettings.emptyDescription")}
            actionLabel={t("settings:absenceSettings.addType")}
            onAction={openCreate}
          />
        )}
      </section>

      <AbsenceTypeDialog
        open={editorOpen}
        title={editing ? t("settings:absenceSettings.editType") : t("settings:absenceSettings.addType")}
        cancelLabel={t("common:actions.cancel")}
        form={form}
        editing={editing}
        pending={saveMutation.isPending}
        removePending={removeMutation.isPending}
        successMessage={successMessage}
        saveError={saveMutation.error}
        removeError={removeMutation.error}
        onClose={closeEditor}
        onSubmit={async (values) => {
          setSuccessMessage(null);
          await saveMutation.mutateAsync(values);
        }}
        onRemove={() => setRemoveDialogOpen(true)}
        t={t}
      />
      <SettingsConfirmDialog
        open={removeDialogOpen}
        title={t(editing?.deletable ? "settings:absenceSettings.deleteTitle" : "settings:absenceSettings.deactivateTitle")}
        description={t(editing?.deletable ? "settings:absenceSettings.deleteDescription" : "settings:absenceSettings.deactivateDescription")}
        confirmLabel={t(editing?.deletable ? "settings:absenceSettings.delete" : "settings:absenceSettings.deactivate")}
        pending={removeMutation.isPending}
        onCancel={() => setRemoveDialogOpen(false)}
        onConfirm={() => {
          if (editing) removeMutation.mutate({ id: editing.id, deletable: Boolean(editing.deletable) });
        }}
      />
      {dialog}
    </div>
  );
}

function toFormValues(type: AbsenceTypeSetting | null, count: number): FormValues {
  const paidMinutes = type?.paidMinutesPerDay ?? 0;
  return {
    name: type?.name ?? "",
    paid: type?.paid ?? false,
    paidHours: paidMinutes / 60,
    color: type?.color ?? "#f97316",
    active: type?.active ?? true,
    displayOrder: type?.displayOrder ?? count + 1
  };
}

function AbsenceTypeDialog({
  open,
  title,
  cancelLabel,
  form,
  editing,
  pending,
  removePending,
  successMessage,
  saveError,
  removeError,
  onClose,
  onSubmit,
  onRemove,
  t
}: {
  open: boolean;
  title: string;
  cancelLabel: string;
  form: UseFormReturn<FormInput, undefined, FormValues>;
  editing: AbsenceTypeSetting | null;
  pending: boolean;
  removePending: boolean;
  successMessage: string | null;
  saveError: unknown;
  removeError: unknown;
  onClose: () => void;
  onSubmit: (values: FormValues) => Promise<void>;
  onRemove: () => void;
  t: TFunction<["settings", "common"]>;
}) {
  if (!open) {
    return null;
  }

  return (
    <LockedModalViewport
      className="z-[60] bg-black/50 px-4 py-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="absence-type-dialog-title"
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label={cancelLabel}
        className="absolute inset-0 h-full w-full cursor-default"
        onClick={onClose}
      />
      <ModalPanel
        as="form"
        className="max-h-[calc(100dvh-2rem)] max-w-sm overflow-y-auto"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <div className="mb-5">
          <h2 id="absence-type-dialog-title" className="text-xl font-semibold tracking-[-0.06em] text-white">
            {title}
          </h2>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-[minmax(0,1fr)_4.75rem] gap-3">
            <Input
              label={t("settings:absenceSettings.fields.name")}
              error={form.formState.errors.name?.message}
              {...form.register("name")}
            />
            <Input
              label={t("settings:absenceSettings.fields.color")}
              type="color"
              className="h-12 p-2"
              error={form.formState.errors.color?.message}
              {...form.register("color")}
            />
          </div>
          <div className="space-y-2">
            <AbsenceToggle
              label={t("settings:absenceSettings.fields.paid")}
              checked={form.watch("paid")}
              onChange={(checked) => {
                form.setValue("paid", checked, { shouldDirty: true, shouldValidate: true });
                form.setValue("paidHours", checked ? "" : 0, {
                  shouldDirty: true,
                  shouldValidate: false
                });
              }}
            />
            <p className="text-xs leading-5 text-white/42">{t("settings:absenceSettings.paidHelp")}</p>
            {form.watch("paid") ? (
              <Input
                label={t("settings:absenceSettings.fields.paidHours")}
                type="text"
                inputMode="decimal"
                min={0}
                max={24}
                error={form.formState.errors.paidHours?.message}
                {...form.register("paidHours")}
              />
            ) : null}
          </div>
        </div>

        {!successMessage && (saveError || removeError) ? (
          <p className="mt-4 text-sm text-red-300">{getApiError(saveError ?? removeError).message}</p>
        ) : null}

        <div className="mt-6 space-y-3">
          {editing ? (
            <Button
              type="button"
              variant="secondary"
              onClick={onRemove}
              disabled={removePending || Boolean(!editing.deletable && !editing.active)}
              className="border-red-400/18 bg-red-400/[0.05] text-white hover:bg-red-400/[0.08]"
            >
              {t(editing.deletable ? "settings:absenceSettings.delete" : "settings:absenceSettings.deactivate")}
            </Button>
          ) : null}
          <ModalActions
            cancelLabel={cancelLabel}
            saveLabel={pending ? t("common:actions.saving") : t("common:actions.save")}
            pending={pending}
            onCancel={onClose}
          />
        </div>
      </ModalPanel>
    </LockedModalViewport>
  );
}

function toPayload(values: FormValues): AbsenceTypePayload {
  return {
    name: values.name.trim(),
    code: null,
    paid: values.paid,
    paidMinutesPerDay: values.paid ? Math.round(values.paidHours * 60) : 0,
    color: values.color,
    active: values.active,
    displayOrder: values.displayOrder
  };
}

function formatPaidHours(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining ? `${hours}h ${remaining}m` : `${hours}h`;
}

function AbsenceToggle({
  label,
  checked,
  onChange
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-7 cursor-pointer items-center gap-2 text-sm font-medium text-white/78">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-white"
      />
      <span>{label}</span>
    </label>
  );
}

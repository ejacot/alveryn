import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Plus, X } from "lucide-react";
import type { TFunction } from "i18next";
import { useEffect, useMemo, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
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
import { SettingsFormActions } from "../components/settings/settings-form-actions";
import { SettingsContextCard } from "../components/settings/settings-context-card";
import { SettingsPageSkeleton } from "../components/settings/settings-page-skeleton";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
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
  const [editing, setEditing] = useState<AbsenceTypeSetting | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const backButtonRef = useRef<HTMLButtonElement | null>(null);
  const largeTitleRef = useRef<HTMLHeadingElement | null>(null);
  const [compactTitleVisible, setCompactTitleVisible] = useState(false);
  const safeBack = useSafeBackNavigation({ fallback: "/profile" });

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

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => deleteAbsenceType(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.absenceTypes.all() });
      setEditorOpen(false);
      setEditing(null);
      form.reset(toFormValues(null, absenceTypes.length));
      setSuccessMessage(t("settings:absenceSettings.deactivated"));
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
      setEditorOpen(false);
      setEditing(null);
      form.reset(toFormValues(null, absenceTypes.length));
    });
  }

  return (
    <div className="mx-auto w-full max-w-[560px] space-y-8 pb-10 pt-12">
      <header className="settings-sticky-header fixed inset-x-0 top-0 z-40 mx-auto flex h-[7.25rem] w-full max-w-[560px] items-start px-5 pt-2">
        <button
          ref={backButtonRef}
          type="button"
          onClick={() => confirmOrRun(safeBack)}
          aria-label={t("common:actions.back")}
          className="mt-[3.25rem] flex h-10 items-center gap-1.5 rounded-md px-0 text-[1.08rem] font-bold leading-none tracking-[-0.045em] text-white transition active:scale-95 focus:outline-none focus:ring-2 focus:ring-white/24"
        >
          <ArrowLeft className="h-[1.22rem] w-[1.22rem]" aria-hidden="true" />
          <span>{t("common:actions.back")}</span>
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

      <SettingsContextCard context="absences" />

      <Button className="w-full gap-2" onClick={openCreate}>
        <Plus className="h-4 w-4" />
        {t("settings:absenceSettings.addType")}
      </Button>

      <section className="space-y-3">
        <p className="hairline-text">{t("settings:absenceSettings.types")}</p>
        <div className="space-y-3">
          {absenceTypes.map((type) => (
            <button
              key={type.id}
              type="button"
              onClick={() => openEdit(type)}
              className="dashboard-glass-card w-full px-5 py-5 text-left transition hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-white/24"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: type.color }} aria-hidden="true" />
                    <p className={`truncate text-[1.05rem] font-semibold tracking-[-0.04em] ${type.active ? "text-white" : "text-white/42"}`}>
                      {type.name}
                    </p>
                  </div>
                  <p className="mt-1 text-sm text-white/46">
                    {type.paid
                      ? t("settings:absenceSettings.paidSummary", { hours: formatPaidHours(type.paidMinutesPerDay) })
                      : t("settings:absenceSettings.unpaidSummary")}
                  </p>
                </div>
                <span className="shrink-0 text-xs uppercase tracking-[0.16em] text-white/28">
                  {type.active ? t("settings:status.active") : t("settings:status.inactive")}
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>

      <AbsenceTypeDialog
        open={editorOpen}
        title={editing ? t("settings:absenceSettings.editType") : t("settings:absenceSettings.addType")}
        cancelLabel={t("common:actions.cancel")}
        form={form}
        editing={editing}
        pending={saveMutation.isPending}
        deactivatePending={deactivateMutation.isPending}
        successMessage={successMessage}
        saveError={saveMutation.error}
        deactivateError={deactivateMutation.error}
        onClose={closeEditor}
        onSubmit={async (values) => {
          setSuccessMessage(null);
          await saveMutation.mutateAsync(values);
        }}
        onDeactivate={() => editing ? deactivateMutation.mutate(editing.id) : undefined}
        t={t}
      />
      {dialog}
      {successMessage && !editorOpen ? (
        <div className="glass-panel fixed inset-x-6 top-24 z-[80] mx-auto max-w-sm rounded-[28px] px-5 py-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-black">
            <Check className="h-6 w-6" />
          </div>
          <p className="mt-3 text-base font-semibold text-white">{successMessage}</p>
        </div>
      ) : null}
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
  deactivatePending,
  successMessage,
  saveError,
  deactivateError,
  onClose,
  onSubmit,
  onDeactivate,
  t
}: {
  open: boolean;
  title: string;
  cancelLabel: string;
  form: UseFormReturn<FormInput, undefined, FormValues>;
  editing: AbsenceTypeSetting | null;
  pending: boolean;
  deactivatePending: boolean;
  successMessage: string | null;
  saveError: unknown;
  deactivateError: unknown;
  onClose: () => void;
  onSubmit: (values: FormValues) => Promise<void>;
  onDeactivate: () => void | undefined;
  t: TFunction<["settings", "common"]>;
}) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4 py-[calc(env(safe-area-inset-top)+1.5rem)] backdrop-blur-sm"
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
      <form
        className="relative z-10 max-h-[calc(100vh-3rem-env(safe-area-inset-top))] w-full max-w-sm overflow-y-auto rounded-[32px] border border-white/[0.08] bg-[#090909]/95 p-5 shadow-[0_28px_90px_rgba(0,0,0,0.55)]"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 id="absence-type-dialog-title" className="text-xl font-semibold tracking-[-0.06em] text-white">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-white/48 transition hover:bg-white/[0.06] hover:text-white focus:outline-none focus:ring-2 focus:ring-white/24"
            aria-label={cancelLabel}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
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
          <div className="rounded-[24px] border border-white/[0.08] bg-white/[0.035] p-4">
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
            {form.watch("paid") ? <div className="mt-4">
              <Input
                label={t("settings:absenceSettings.fields.paidHours")}
                type="text"
                inputMode="decimal"
                min={0}
                max={24}
                error={form.formState.errors.paidHours?.message}
                {...form.register("paidHours")}
              />
            </div> : null}
          </div>
        </div>

        {!successMessage && (saveError || deactivateError) ? (
          <p className="mt-4 text-sm text-red-300">{getApiError(saveError ?? deactivateError).message}</p>
        ) : null}

        <SettingsFormActions
          submitting={pending}
          successMessage={successMessage}
          onDelete={editing ? onDeactivate : undefined}
          deleteLabel={editing ? t("settings:absenceSettings.deactivate") : undefined}
          deleteDisabled={deactivatePending || !editing?.active}
        />
      </form>
    </div>
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
    <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.035] px-4">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-5 w-5 accent-white"
      />
      <span className="text-sm font-semibold text-white/78">{label}</span>
    </label>
  );
}

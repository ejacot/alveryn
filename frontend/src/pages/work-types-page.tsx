import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { getApiError } from "../api/api-errors";
import { queryKeys } from "../api/query-keys";
import { deleteWorkType, listWorkTypes, updateWorkType } from "../api/endpoints";
import { SettingsEmptyState } from "../components/settings/settings-empty-state";
import { SettingsPageHeader } from "../components/settings/settings-page-header";
import { SettingsPageSkeleton } from "../components/settings/settings-page-skeleton";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { ScreenMessage } from "../components/ui/screen-message";
import type { WorkType } from "../types/configuration";

const WORK_TYPE_COLORS = [
  "#FFFFFF",
  "#A3E635",
  "#34D399",
  "#60A5FA",
  "#FBBF24",
  "#FB7185"
] as const;

export function WorkTypesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation(["common", "settings"]);
  const [editingWorkType, setEditingWorkType] = useState<WorkType | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("#FFFFFF");
  const [editError, setEditError] = useState<string | null>(null);
  const workTypesQuery = useQuery({
    queryKey: queryKeys.workTypes.all(),
    queryFn: listWorkTypes
  });
  const updateMutation = useMutation({
    mutationFn: (workType: WorkType) =>
      updateWorkType(workType.id, {
        name: editName.trim().toLocaleUpperCase(),
        calculationMethod: workType.calculationMethod,
        color: editColor,
        icon: workType.icon,
        defaultBreakMinutes: workType.defaultBreakMinutes,
        displayOrder: workType.displayOrder,
        active: workType.active
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.workTypes.all() });
      setEditingWorkType(null);
      setEditName("");
      setEditColor("#FFFFFF");
      setEditError(null);
    },
    onError: (error) => {
      setEditError(getApiError(error).message);
    }
  });
  const deleteMutation = useMutation({
    mutationFn: (workType: WorkType) => deleteWorkType(workType.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.workTypes.all() });
      setEditingWorkType(null);
      setEditName("");
      setEditColor("#FFFFFF");
      setEditError(null);
    },
    onError: (error) => {
      setEditError(getApiError(error).message);
    }
  });

  function openWorkType(workType: WorkType) {
    if (workType.calculationMethod === "UNIT_BASED") {
      navigate(`/settings/work-types/${workType.id}`);
      return;
    }

    setEditError(null);
    setEditName(workType.name);
    setEditColor(workType.color);
    setEditingWorkType(workType);
  }

  function closeWorkTypeDialog() {
    if (updateMutation.isPending || deleteMutation.isPending) return;
    setEditingWorkType(null);
    setEditName("");
    setEditColor("#FFFFFF");
    setEditError(null);
  }

  if (workTypesQuery.isLoading) {
    return <SettingsPageSkeleton />;
  }

  if (workTypesQuery.error) {
    return <ScreenMessage title="Work types are unavailable" description={getApiError(workTypesQuery.error).message} />;
  }

  const items = [...(workTypesQuery.data ?? [])].sort((left, right) => {
    if (left.active !== right.active) return left.active ? -1 : 1;
    return left.displayOrder - right.displayOrder || left.name.localeCompare(right.name);
  });
  const timeBasedItems = items.filter((item) => item.calculationMethod === "TIME_BASED");
  const unitBasedItems = items.filter((item) => item.calculationMethod === "UNIT_BASED");

  return (
    <div className="space-y-8 pb-10">
      <SettingsPageHeader title="Work types" fallbackHref="/profile" />
      <Button className="w-full gap-2" onClick={() => navigate("/settings/work-types/new")}>
        <Plus className="h-4 w-4" />
        Add work type
      </Button>

      {!items.length ? (
        <SettingsEmptyState
          title="No work types yet"
          description="Create your first time-based or unit-based type to start tracking work."
          actionLabel="Add work type"
          onAction={() => navigate("/settings/work-types/new")}
        />
      ) : (
        <div className="space-y-7">
          <WorkTypeGroup
            title="Time based"
            items={timeBasedItems}
            onSelect={openWorkType}
          />
          <WorkTypeGroup
            title="Unit based"
            items={unitBasedItems}
            onSelect={openWorkType}
          />
        </div>
      )}
      <TimeWorkTypeDialog
        workType={editingWorkType}
        name={editName}
        color={editColor}
        error={editError}
        pending={updateMutation.isPending || deleteMutation.isPending}
        onNameChange={(value) => {
          setEditName(value.toLocaleUpperCase());
          setEditError(null);
        }}
        onColorChange={setEditColor}
        onClose={closeWorkTypeDialog}
        onSave={() => {
          if (!editingWorkType) return;
          if (!editName.trim()) {
            setEditError("Name is required");
            return;
          }
          updateMutation.mutate(editingWorkType);
        }}
        onDeactivate={() => {
          if (!editingWorkType) return;
          deleteMutation.mutate(editingWorkType);
        }}
        saveLabel={updateMutation.isPending ? t("common:actions.saving") : t("common:actions.save")}
        cancelLabel={t("common:actions.cancel")}
        deactivateLabel={t("settings:workTypeEditor.deactivate")}
      />
    </div>
  );
}

function WorkTypeGroup({
  title,
  items,
  onSelect
}: {
  title: string;
  items: WorkType[];
  onSelect: (workType: WorkType) => void;
}) {
  if (!items.length) {
    return null;
  }

  return (
    <section className="space-y-3">
      <p className="hairline-text">{title}</p>
      <div className="space-y-4">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item)}
            className="dashboard-glass-card w-full px-5 py-5 text-left transition hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-white/24"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-4">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: item.color }} aria-hidden="true" />
                <p className={`text-[1.05rem] font-semibold tracking-[-0.04em] ${item.active ? "text-white" : "text-white/42"}`}>
                  {item.name}
                </p>
              </div>
              <span className="text-xs uppercase tracking-[0.16em] text-white/28">
                {item.active ? "Active" : "Inactive"}
              </span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function TimeWorkTypeDialog({
  workType,
  name,
  color,
  error,
  pending,
  onNameChange,
  onColorChange,
  onClose,
  onSave,
  onDeactivate,
  saveLabel,
  cancelLabel,
  deactivateLabel
}: {
  workType: WorkType | null;
  name: string;
  color: string;
  error: string | null;
  pending: boolean;
  onNameChange: (value: string) => void;
  onColorChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
  onDeactivate: () => void;
  saveLabel: string;
  cancelLabel: string;
  deactivateLabel: string;
}) {
  if (!workType) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-[calc(env(safe-area-inset-top)+1.5rem)] backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="time-work-type-dialog-title"
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label={cancelLabel}
        className="absolute inset-0 h-full w-full cursor-default"
        onClick={onClose}
      />
      <div
        className="relative z-10 w-full max-w-sm rounded-[32px] border border-white/[0.08] bg-[#090909]/95 p-5 shadow-[0_28px_90px_rgba(0,0,0,0.55)]"
      >
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 id="time-work-type-dialog-title" className="text-xl font-semibold tracking-[-0.06em] text-white">
            {workType.name}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-full px-3 py-2 text-sm font-semibold text-white/48 transition hover:text-white disabled:opacity-50"
          >
            {cancelLabel}
          </button>
        </div>

        <div className="space-y-4">
          {error ? (
            <p
              role="alert"
              className="rounded-[22px] border border-red-400/20 bg-red-400/[0.08] px-4 py-3 text-sm text-red-100"
            >
              {error}
            </p>
          ) : null}
          <Input
            label="Name"
            value={name}
            onChange={(event) => onNameChange(event.currentTarget.value)}
          />
          <div className="space-y-2">
            <p className="hairline-text">Color</p>
            <div className="grid grid-cols-6 gap-2">
              {WORK_TYPE_COLORS.map((option) => {
                const selected = option.toLocaleUpperCase() === color.toLocaleUpperCase();
                return (
                  <button
                    key={option}
                    type="button"
                    aria-label={`Choose color ${option}`}
                    aria-pressed={selected}
                    onClick={() => onColorChange(option)}
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
          <div className="grid gap-3">
            <Button
              type="button"
              variant="secondary"
              className="w-full border-red-400/18 bg-red-400/[0.05] text-white hover:bg-red-400/[0.08]"
              disabled={pending}
              onClick={onDeactivate}
            >
              {deactivateLabel}
            </Button>
            <Button type="button" className="w-full" disabled={pending} onClick={onSave}>
              {saveLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { getApiError } from "../api/api-errors";
import { queryKeys } from "../api/query-keys";
import { createWorkType, deleteWorkType, listWorkTypes, updateWorkType } from "../api/endpoints";
import { SettingsEmptyState } from "../components/settings/settings-empty-state";
import { SettingsPageHeader } from "../components/settings/settings-page-header";
import { SettingsPageSkeleton } from "../components/settings/settings-page-skeleton";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { ScreenMessage } from "../components/ui/screen-message";
import type { WorkType } from "../types/configuration";

const WORK_TYPE_COLORS = [
  "#A3E635",
  "#34D399",
  "#60A5FA",
  "#FBBF24",
  "#FB7185"
] as const;
const DEFAULT_WORK_TYPE_COLOR = WORK_TYPE_COLORS[0];

export function WorkTypesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation(["common", "settings"]);
  const [editingWorkType, setEditingWorkType] = useState<WorkType | null>(null);
  const [creatingWorkType, setCreatingWorkType] = useState(false);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState<string>(DEFAULT_WORK_TYPE_COLOR);
  const [editDefaultBreakMinutes, setEditDefaultBreakMinutes] = useState(30);
  const [editCalculationMethod, setEditCalculationMethod] = useState<WorkType["calculationMethod"]>("TIME_BASED");
  const [editCompensationMethod, setEditCompensationMethod] =
    useState<NonNullable<WorkType["compensationMethod"]>>("HOURLY");
  const [editError, setEditError] = useState<string | null>(null);
  const workTypesQuery = useQuery({
    queryKey: queryKeys.workTypes.all(),
    queryFn: listWorkTypes
  });
  const updateMutation = useMutation({
    mutationFn: (workType: WorkType) =>
      updateWorkType(workType.id, {
			        name: editName.trim().toLocaleUpperCase(),
			        calculationMethod: editCalculationMethod,
			        ...(editCalculationMethod === "UNIT_BASED" && editCompensationMethod === "PER_UNIT"
			          ? { compensationMethod: editCompensationMethod }
			          : {}),
			        color: editColor,
		        icon: null,
	        defaultBreakMinutes: editCalculationMethod === "TIME_BASED" ? editDefaultBreakMinutes : null,
        displayOrder: workType.displayOrder,
        active: workType.active
      }),
	    onSuccess: async (workType) => {
	      await queryClient.invalidateQueries({ queryKey: queryKeys.workTypes.all() });
	      setEditingWorkType(null);
		      setEditName("");
		      setEditColor(DEFAULT_WORK_TYPE_COLOR);
	      setEditDefaultBreakMinutes(30);
      setEditCalculationMethod("TIME_BASED");
      setEditCompensationMethod("HOURLY");
      setEditError(null);
      if (workType.calculationMethod === "UNIT_BASED") {
        navigate(`/settings/work-types/${workType.id}`);
      }
    },
    onError: (error) => {
      setEditError(getApiError(error).message);
    }
  });
  const createMutation = useMutation({
    mutationFn: () =>
      createWorkType({
			        name: editName.trim().toLocaleUpperCase(),
			        calculationMethod: editCalculationMethod,
			        ...(editCalculationMethod === "UNIT_BASED" && editCompensationMethod === "PER_UNIT"
			          ? { compensationMethod: editCompensationMethod }
			          : {}),
			        color: editColor,
		        icon: null,
	        defaultBreakMinutes: editCalculationMethod === "TIME_BASED" ? editDefaultBreakMinutes : null
	      }),
    onSuccess: async (workType) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.workTypes.all() });
      setCreatingWorkType(false);
		      setEditName("");
		      setEditColor(DEFAULT_WORK_TYPE_COLOR);
	      setEditDefaultBreakMinutes(30);
      setEditCalculationMethod("TIME_BASED");
      setEditCompensationMethod("HOURLY");
      setEditError(null);
      if (workType.calculationMethod === "UNIT_BASED") {
        navigate(`/settings/work-types/${workType.id}`);
      }
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
	      setEditColor(DEFAULT_WORK_TYPE_COLOR);
	      setEditDefaultBreakMinutes(30);
      setEditCalculationMethod("TIME_BASED");
      setEditCompensationMethod("HOURLY");
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
    setEditDefaultBreakMinutes(workType.defaultBreakMinutes ?? 30);
    setEditCalculationMethod(workType.calculationMethod);
    setEditCompensationMethod(workType.compensationMethod ?? "HOURLY");
    setEditingWorkType(workType);
  }

  function openCreateWorkType() {
	    setEditError(null);
	    setEditName("");
	    setEditColor(DEFAULT_WORK_TYPE_COLOR);
	    setEditDefaultBreakMinutes(30);
    setEditCalculationMethod("TIME_BASED");
    setEditCompensationMethod("HOURLY");
    setCreatingWorkType(true);
  }

  function closeWorkTypeDialog() {
    if (createMutation.isPending || updateMutation.isPending || deleteMutation.isPending) return;
	    setEditingWorkType(null);
	    setCreatingWorkType(false);
	    setEditName("");
	    setEditColor(DEFAULT_WORK_TYPE_COLOR);
	    setEditDefaultBreakMinutes(30);
    setEditCalculationMethod("TIME_BASED");
    setEditCompensationMethod("HOURLY");
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
      <Button className="w-full gap-2" onClick={openCreateWorkType}>
        <Plus className="h-4 w-4" />
        Add work type
      </Button>

      {!items.length ? (
        <SettingsEmptyState
          title="No work types yet"
          description="Create your first time-based or unit-based type to start tracking work."
          actionLabel="Add work type"
          onAction={openCreateWorkType}
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
      <WorkTypeDialog
        mode={creatingWorkType ? "create" : "edit"}
        workType={editingWorkType}
	        name={editName}
	        color={editColor}
	        defaultBreakMinutes={editDefaultBreakMinutes}
	        calculationMethod={editCalculationMethod}
	        compensationMethod={editCompensationMethod}
        error={editError}
        pending={createMutation.isPending || updateMutation.isPending || deleteMutation.isPending}
        onNameChange={(value) => {
          setEditName(value.toLocaleUpperCase());
          setEditError(null);
        }}
	        onColorChange={setEditColor}
	        onDefaultBreakMinutesChange={setEditDefaultBreakMinutes}
        onCalculationMethodChange={(value) => {
          setEditCalculationMethod(value);
          if (value === "TIME_BASED") {
            setEditCompensationMethod("HOURLY");
          }
        }}
        onCompensationMethodChange={setEditCompensationMethod}
        onClose={closeWorkTypeDialog}
        onSave={() => {
          if (!editName.trim()) {
            setEditError("Name is required");
            return;
          }
          if (creatingWorkType) {
            createMutation.mutate();
            return;
          }
          if (!editingWorkType) return;
          updateMutation.mutate(editingWorkType);
        }}
        onDeactivate={() => {
          if (!editingWorkType) return;
          deleteMutation.mutate(editingWorkType);
        }}
        saveLabel={(createMutation.isPending || updateMutation.isPending) ? t("common:actions.saving") : t("common:actions.save")}
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

function WorkTypeDialog({
  mode,
  workType,
  name,
  color,
  defaultBreakMinutes,
  calculationMethod,
  compensationMethod,
  error,
  pending,
  onNameChange,
  onColorChange,
  onDefaultBreakMinutesChange,
  onCalculationMethodChange,
  onCompensationMethodChange,
  onClose,
  onSave,
  onDeactivate,
  saveLabel,
  cancelLabel,
  deactivateLabel
}: {
  mode: "create" | "edit";
  workType: WorkType | null;
  name: string;
  color: string;
  defaultBreakMinutes: number;
  calculationMethod: WorkType["calculationMethod"];
  compensationMethod: NonNullable<WorkType["compensationMethod"]>;
  error: string | null;
  pending: boolean;
  onNameChange: (value: string) => void;
  onColorChange: (value: string) => void;
  onDefaultBreakMinutesChange: (value: number) => void;
  onCalculationMethodChange: (value: WorkType["calculationMethod"]) => void;
  onCompensationMethodChange: (value: NonNullable<WorkType["compensationMethod"]>) => void;
  onClose: () => void;
  onSave: () => void;
  onDeactivate: () => void;
  saveLabel: string;
  cancelLabel: string;
  deactivateLabel: string;
}) {
  const { t } = useTranslation(["settings"]);

  if (mode === "edit" && !workType) {
    return null;
  }

  const title = mode === "create" ? "Add work type" : workType?.name ?? "Work type";

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
            {title}
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
            <p className="hairline-text">Type</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: "TIME_BASED" as const, label: "Time" },
                { value: "UNIT_BASED" as const, label: "Units" }
              ].map((option) => {
                const selected = calculationMethod === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={selected}
                    disabled={pending}
                    onClick={() => onCalculationMethodChange(option.value)}
                    className={[
                      "min-h-12 rounded-full border px-4 text-sm font-semibold tracking-[-0.03em] transition disabled:opacity-55",
                      selected
                        ? "border-white bg-white text-black shadow-[0_16px_36px_rgba(255,255,255,0.12)]"
                        : "border-white/[0.1] bg-white/[0.045] text-white/62 hover:bg-white/[0.08] hover:text-white"
                    ].join(" ")}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
          {calculationMethod === "UNIT_BASED" ? (
            <div className="space-y-2">
              <p className="hairline-text">{t("workTypeEditor.fields.compensationMethod")}</p>
              <div className="grid gap-3">
                {[
                  {
                    value: "HOURLY" as const,
                    label: t("workTypeEditor.compensation.hourly"),
                    description: t("workTypeEditor.compensation.hourlyDescription")
                  },
                  {
                    value: "PER_UNIT" as const,
                    label: t("workTypeEditor.compensation.perUnit"),
                    description: t("workTypeEditor.compensation.perUnitDescription")
                  }
                ].map((option) => {
                  const selected = compensationMethod === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={selected}
                      disabled={pending}
                      onClick={() => onCompensationMethodChange(option.value)}
                      className={[
                        "rounded-[22px] border px-4 py-3 text-left transition disabled:opacity-55",
                        selected
                          ? "border-white bg-white text-black shadow-[0_16px_36px_rgba(255,255,255,0.12)]"
                          : "border-white/[0.1] bg-white/[0.045] text-white/62 hover:bg-white/[0.08] hover:text-white"
                      ].join(" ")}
                    >
                      <span className="block text-sm font-semibold">{option.label}</span>
                      <span className="mt-1 block text-xs opacity-70">{option.description}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
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
	          {calculationMethod === "TIME_BASED" ? (
	            <Input
	              label="Default break"
	              type="number"
	              inputMode="numeric"
	              min={0}
	              value={Number.isFinite(defaultBreakMinutes) ? String(defaultBreakMinutes) : ""}
	              onChange={(event) => onDefaultBreakMinutesChange(Number(event.currentTarget.value))}
	            />
	          ) : null}
	          <div className="grid gap-3">
            {mode === "edit" ? (
              <Button
                type="button"
                variant="secondary"
                className="w-full border-red-400/18 bg-red-400/[0.05] text-white hover:bg-red-400/[0.08]"
                disabled={pending}
                onClick={onDeactivate}
              >
                {deactivateLabel}
              </Button>
            ) : null}
            <Button type="button" className="w-full" disabled={pending} onClick={onSave}>
              {saveLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

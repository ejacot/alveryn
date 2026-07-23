import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Clock3, Coins, Plus, Ruler, X } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getApiError } from "../api/api-errors";
import { queryKeys } from "../api/query-keys";
import { listWorkTypes } from "../api/endpoints";
import { SettingsEmptyState } from "../components/settings/settings-empty-state";
import { SettingsPageSkeleton } from "../components/settings/settings-page-skeleton";
import { SettingsNavigationHeader } from "../components/settings/settings-navigation-header";
import { Card } from "../components/ui/card";
import { LockedModalViewport } from "../components/ui/locked-modal-viewport";
import { ModalPanel } from "../components/ui/modal-panel";
import { ScreenMessage } from "../components/ui/screen-message";
import { useSafeBackNavigation } from "../hooks/use-safe-back-navigation";
import type { WorkType, WorkTypeFormulaMode } from "../types/configuration";
import type { CalculationMethod, CompensationMethod } from "../types/work-calculation";

export function WorkTypesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const employmentId = searchParams.get("employmentId");
  const safeBack = useSafeBackNavigation({ fallback: employmentId ? `/settings/employment/${employmentId}` : "/profile" });
  const { t } = useTranslation(["common", "settings"]);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [expandedParentIds, setExpandedParentIds] = useState<Set<string>>(new Set());
  const workTypesQuery = useQuery({
    queryKey: queryKeys.workTypes.all(),
    queryFn: listWorkTypes
  });

  function openWorkType(workType: WorkType) {
    navigate(`/settings/work-types/${workType.id}${employmentId ? `?employmentId=${employmentId}` : ""}`);
  }

  function toggleParent(workTypeId: string) {
    setExpandedParentIds((current) => {
      const next = new Set(current);
      if (next.has(workTypeId)) {
        next.delete(workTypeId);
      } else {
        next.add(workTypeId);
      }
      return next;
    });
  }

  function openNewWorkType(option: WorkTypeSetupOption) {
    setAddDialogOpen(false);
    const params = new URLSearchParams({ mode: option.mode });
    if (employmentId) params.set("employmentId", employmentId);
    navigate(`/settings/work-types/new?${params.toString()}`, {
      state: {
        setupMode: option.mode,
        calculationMethod: option.calculationMethod,
        compensationMethod: option.compensationMethod
      }
    });
  }

  if (workTypesQuery.isLoading) {
    return <SettingsPageSkeleton />;
  }

  if (workTypesQuery.error) {
    return <ScreenMessage title="Work types are unavailable" description={getApiError(workTypesQuery.error).message} />;
  }

  const items = [...(workTypesQuery.data ?? [])]
    .filter((item) => !employmentId || item.employmentId === employmentId)
    .sort((left, right) => {
      if (left.active !== right.active) return left.active ? -1 : 1;
      return left.displayOrder - right.displayOrder || left.name.localeCompare(right.name);
    });
  const parentItems = items.filter((item) => !item.parentId);
  const childrenByParentId = items.reduce<Record<string, WorkType[]>>((groups, item) => {
    if (!item.parentId) {
      return groups;
    }
    groups[item.parentId] = [...(groups[item.parentId] ?? []), item];
    return groups;
  }, {});
  const title = t("settings:workTypes");

  return (
    <div className="mx-auto w-full max-w-[560px] space-y-6 pb-10 pt-8">
      <SettingsNavigationHeader
        title={title}
        backLabel={t("common:actions.back")}
        onBack={safeBack}
        action={parentItems.length ? {
          label: t("settings:workSetup.addWorkType"),
          icon: <Plus className="h-5 w-5" aria-hidden="true" />,
          onClick: () => setAddDialogOpen(true)
        } : undefined}
      />

      <p className="text-sm leading-6 text-white/46">{t("settings:pageInfo.workTypes.description")}</p>

      {!parentItems.length ? (
        <SettingsEmptyState
          title={t("settings:workSetup.emptyTitle")}
          description={t("settings:workSetup.emptyDescription")}
          actionLabel={t("settings:workSetup.addWorkType")}
          onAction={() => setAddDialogOpen(true)}
        />
      ) : (
        <WorkTypeList
          items={parentItems}
          onSelect={openWorkType}
          onToggle={toggleParent}
          childrenByParentId={childrenByParentId}
          expandedParentIds={expandedParentIds}
          childCountLabel={(count) => t("settings:workSetup.formulaCount", { count })}
          inactiveLabel={t("settings:status.inactive")}
        />
      )}

      <AddWorkTypeDialog
        open={addDialogOpen}
        title={t("settings:workTypeEditor.chooseModeTitle")}
        cancelLabel={t("common:actions.cancel")}
        options={workTypeSetupOptions(t)}
        onClose={() => setAddDialogOpen(false)}
        onSelect={openNewWorkType}
      />
    </div>
  );
}

type WorkTypeSetupOption = {
  mode: WorkTypeFormulaMode;
  calculationMethod: CalculationMethod;
  compensationMethod: CompensationMethod;
  title: string;
  description: string;
  formula: string;
  suggestedName: string;
  icon: React.ReactNode;
};

function AddWorkTypeDialog({
  open,
  title,
  cancelLabel,
  options,
  onClose,
  onSelect
}: {
  open: boolean;
  title: string;
  cancelLabel: string;
  options: WorkTypeSetupOption[];
  onClose: () => void;
  onSelect: (option: WorkTypeSetupOption) => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <LockedModalViewport
      className="z-[60] bg-black/50 px-4 py-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-work-type-title"
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label={cancelLabel}
        className="absolute inset-0 h-full w-full cursor-default"
        onClick={onClose}
      />
      <ModalPanel className="max-w-sm">
        <div className="mb-4 flex items-center justify-between gap-4 px-1">
          <h2 id="add-work-type-title" className="text-[1.35rem] font-semibold leading-none tracking-[-0.06em] text-white">
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
        <div className="grid grid-cols-2 gap-3">
          {options.map((option) => (
            <button
              key={option.mode}
              type="button"
              className="min-h-[12rem] rounded-[26px] border border-white/[0.08] bg-white/[0.045] px-3.5 py-4 text-left transition hover:-translate-y-0.5 hover:bg-white/[0.075] active:translate-y-0 focus:outline-none focus:ring-2 focus:ring-white/24 sm:px-4"
              onClick={() => onSelect(option)}
            >
              <span className="flex h-full flex-col justify-between gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.07] text-white/68 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                  {option.icon}
                </span>
                <span className="min-w-0 space-y-2">
                  <span className="block text-[1rem] font-semibold leading-[1.05] tracking-[-0.045em] text-white sm:text-[1.05rem]">
                    {option.title}
                  </span>
                  <span className="block text-xs leading-4 text-white/48">
                    {option.description}
                  </span>
                  <span className="block min-h-8 text-[0.68rem] font-semibold uppercase leading-4 tracking-[0.11em] text-white/34">
                    {option.formula}
                  </span>
                </span>
              </span>
            </button>
          ))}
        </div>
      </ModalPanel>
    </LockedModalViewport>
  );
}

function WorkTypeList({
  items,
  onSelect,
  onToggle,
  childrenByParentId,
  expandedParentIds,
  childCountLabel,
  inactiveLabel
}: {
  items: WorkType[];
  onSelect: (workType: WorkType) => void;
  onToggle: (workTypeId: string) => void;
  childrenByParentId: Record<string, WorkType[]>;
  expandedParentIds: Set<string>;
  childCountLabel: (count: number) => string;
  inactiveLabel: string;
}) {
  return (
    <section className="space-y-4">
      {items.map((item) => {
          const children = childrenByParentId[item.id] ?? [];
          const expandable = children.length > 0;
          const expanded = expandedParentIds.has(item.id);
          return (
            <Card key={item.id} className="overflow-hidden">
              <div className="flex items-stretch">
                <button
                  type="button"
                  onClick={() => onSelect(item)}
                  className="flex min-h-[5.25rem] min-w-0 flex-1 items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-white/24 focus:ring-inset"
                >
                  <span className="min-w-0 flex-1">
                    <span className={`font-name block truncate text-[1.05rem] font-semibold tracking-[-0.04em] ${item.active ? "text-white" : "text-white/42"}`}>
                      {item.name}
                    </span>
                    <span className="mt-1 block truncate text-sm text-white/48">
                      {expandable ? childCountLabel(children.length) : workTypeSummary(item)}
                      {!item.active ? ` · ${inactiveLabel}` : ""}
                    </span>
                  </span>
                  {!expandable ? <ChevronRight className="h-4 w-4 shrink-0 text-white/24" aria-hidden="true" /> : null}
                </button>
                {expandable ? (
                  <button
                    type="button"
                    onClick={() => onToggle(item.id)}
                    aria-expanded={expanded}
                    aria-label={expanded ? `Collapse ${item.name}` : `Expand ${item.name}`}
                    className="flex w-14 shrink-0 items-center justify-center border-l border-white/[0.06] text-white/42 transition hover:bg-white/[0.06] hover:text-white focus:outline-none focus:ring-2 focus:ring-white/24"
                  >
                    <ChevronDown className={`h-5 w-5 transition ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
                  </button>
                ) : null}
              </div>
              {expanded ? (
                <div className="border-t border-white/[0.06] bg-white/[0.025] px-3 py-3">
                  <div className="space-y-2">
                    {children.map((child) => (
                      <button
                        key={child.id}
                        type="button"
                        onClick={() => onSelect(child)}
                        className="w-full rounded-[22px] border border-white/[0.06] bg-white/[0.035] px-4 py-3 text-left transition hover:bg-white/[0.07] focus:outline-none focus:ring-2 focus:ring-white/24"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className={`font-name truncate text-sm font-semibold tracking-[-0.03em] ${child.active ? "text-white/82" : "text-white/38"}`}>
                              {child.name}
                            </p>
                            <p className="mt-0.5 text-xs text-white/34">{workTypeSummary(child)}</p>
                          </div>
                          <ChevronRight className="h-4 w-4 shrink-0 text-white/24" aria-hidden="true" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </Card>
          );
        })}
    </section>
  );
}

function workTypeSummary(item: WorkType) {
  if (item.calculationMethod === "TIME_BASED") {
    return item.defaultBreakMinutes ? `${item.defaultBreakMinutes} min default break` : "Time based";
  }

  if (item.calculationMethod === "UNITS_PER_HOUR_BASED") {
    return item.unitsPerHour ? `${item.unitsPerHour} units / hour` : "Units to hours";
  }

  if (item.calculationMethod === "FIXED_PRICE_BASED") {
    return "Fixed amount";
  }

  return item.ratePerUnit && item.currency
    ? `${item.ratePerUnit} ${item.currency} / ${item.unitSymbol ?? item.unitLabel ?? "unit"}`
    : "Direct unit rate";
}

function workTypeSetupOptions(t: ReturnType<typeof useTranslation<["common", "settings"]>>["t"]): WorkTypeSetupOption[] {
  return [
    {
      mode: "TIME_HOURLY",
      calculationMethod: "TIME_BASED",
      compensationMethod: "HOURLY",
      title: t("settings:workTypeEditor.modes.timeTitle"),
      description: t("settings:workTypeEditor.modes.timeDescription"),
      formula: t("settings:workTypeEditor.modes.timeFormula"),
      suggestedName: t("settings:workTypeEditor.modes.timeSuggestedName"),
      icon: <Clock3 className="h-5 w-5" aria-hidden="true" />
    },
    {
      mode: "UNITS_PER_HOUR",
      calculationMethod: "UNITS_PER_HOUR_BASED",
      compensationMethod: "HOURLY",
      title: t("settings:workTypeEditor.modes.unitsPerHourTitle"),
      description: t("settings:workTypeEditor.modes.unitsPerHourDescription"),
      formula: t("settings:workTypeEditor.modes.unitsPerHourFormula"),
      suggestedName: t("settings:workTypeEditor.modes.unitsPerHourSuggestedName"),
      icon: <Ruler className="h-5 w-5" aria-hidden="true" />
    },
    {
      mode: "UNITS_PER_UNIT",
      calculationMethod: "UNIT_BASED",
      compensationMethod: "PER_UNIT",
      title: t("settings:workTypeEditor.modes.perUnitTitle"),
      description: t("settings:workTypeEditor.modes.perUnitDescription"),
      formula: t("settings:workTypeEditor.modes.perUnitFormula"),
      suggestedName: t("settings:workTypeEditor.modes.perUnitSuggestedName"),
      icon: <Coins className="h-5 w-5" aria-hidden="true" />
    },
    {
      mode: "FIXED_AMOUNT",
      calculationMethod: "FIXED_PRICE_BASED",
      compensationMethod: "HOURLY",
      title: t("settings:workTypeEditor.modes.fixedTitle"),
      description: t("settings:workTypeEditor.modes.fixedDescription"),
      formula: t("settings:workTypeEditor.modes.fixedFormula"),
      suggestedName: t("settings:workTypeEditor.modes.fixedSuggestedName"),
      icon: <Coins className="h-5 w-5" aria-hidden="true" />
    }
  ];
}

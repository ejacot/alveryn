import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronDown, Clock3, Coins, Pencil, Plus, Ruler, X } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { getApiError } from "../api/api-errors";
import { queryKeys } from "../api/query-keys";
import { listWorkTypes } from "../api/endpoints";
import { SettingsEmptyState } from "../components/settings/settings-empty-state";
import { SettingsContextCard } from "../components/settings/settings-context-card";
import { SettingsPageSkeleton } from "../components/settings/settings-page-skeleton";
import { Button } from "../components/ui/button";
import { ScreenMessage } from "../components/ui/screen-message";
import { useSafeBackNavigation } from "../hooks/use-safe-back-navigation";
import type { WorkType, WorkTypeFormulaMode } from "../types/configuration";
import type { CalculationMethod, CompensationMethod } from "../types/work-calculation";

export function WorkTypesPage() {
  const navigate = useNavigate();
  const safeBack = useSafeBackNavigation({ fallback: "/profile" });
  const { t } = useTranslation(["common", "settings"]);
  const backButtonRef = useRef<HTMLButtonElement | null>(null);
  const largeTitleRef = useRef<HTMLHeadingElement | null>(null);
  const [compactTitleVisible, setCompactTitleVisible] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [expandedParentIds, setExpandedParentIds] = useState<Set<string>>(new Set());
  const workTypesQuery = useQuery({
    queryKey: queryKeys.workTypes.all(),
    queryFn: listWorkTypes
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

  function openWorkType(workType: WorkType) {
    navigate(`/settings/work-types/${workType.id}`);
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
    navigate(`/settings/work-types/new?mode=${option.mode}`, {
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

  const items = [...(workTypesQuery.data ?? [])].sort((left, right) => {
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
  const timeBasedItems = parentItems.filter((item) => item.calculationMethod === "TIME_BASED");
  const unitsPerHourItems = parentItems.filter((item) => item.calculationMethod === "UNITS_PER_HOUR_BASED");
  const unitBasedItems = parentItems.filter((item) => item.calculationMethod === "UNIT_BASED");
  const fixedAmountItems = parentItems.filter((item) => item.calculationMethod === "FIXED_PRICE_BASED");
  const title = t("settings:workSetup.title");

  return (
    <div className="mx-auto w-full max-w-[560px] space-y-8 pb-10 pt-12">
      <header className="settings-sticky-header fixed inset-x-0 top-0 z-40 mx-auto flex h-[7.25rem] w-full max-w-[560px] items-start px-5 pt-2">
        <button
          ref={backButtonRef}
          type="button"
          onClick={safeBack}
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
      <SettingsContextCard context="workTypes" />
      <Button className="w-full gap-2" onClick={() => setAddDialogOpen(true)}>
        <Plus className="h-4 w-4" />
        {t("settings:workSetup.addWorkType")}
      </Button>

      {!parentItems.length ? (
        <SettingsEmptyState
          title="No work types yet"
          description={t("settings:workSetup.emptyDescription")}
          actionLabel={t("settings:workSetup.addWorkType")}
          onAction={() => setAddDialogOpen(true)}
        />
      ) : (
        <div className="space-y-7">
          <WorkTypeGroup
            title={t("settings:workTypeEditor.modes.timeTitle")}
            items={timeBasedItems}
            onSelect={openWorkType}
            onToggle={toggleParent}
            childrenByParentId={childrenByParentId}
            expandedParentIds={expandedParentIds}
            childCountLabel={(count) => t("settings:workSetup.formulaCount", { count })}
            activeLabel={t("settings:status.active")}
            inactiveLabel={t("settings:status.inactive")}
          />
          <WorkTypeGroup
            title={t("settings:workTypeEditor.modes.unitsPerHourTitle")}
            items={unitsPerHourItems}
            onSelect={openWorkType}
            onToggle={toggleParent}
            childrenByParentId={childrenByParentId}
            expandedParentIds={expandedParentIds}
            childCountLabel={(count) => t("settings:workSetup.formulaCount", { count })}
            activeLabel={t("settings:status.active")}
            inactiveLabel={t("settings:status.inactive")}
          />
          <WorkTypeGroup
            title={t("settings:workTypeEditor.modes.perUnitTitle")}
            items={unitBasedItems}
            onSelect={openWorkType}
            onToggle={toggleParent}
            childrenByParentId={childrenByParentId}
            expandedParentIds={expandedParentIds}
            childCountLabel={(count) => t("settings:workSetup.formulaCount", { count })}
            activeLabel={t("settings:status.active")}
            inactiveLabel={t("settings:status.inactive")}
          />
          <WorkTypeGroup
            title={t("settings:workTypeEditor.modes.fixedTitle")}
            items={fixedAmountItems}
            onSelect={openWorkType}
            onToggle={toggleParent}
            childrenByParentId={childrenByParentId}
            expandedParentIds={expandedParentIds}
            childCountLabel={(count) => t("settings:workSetup.formulaCount", { count })}
            activeLabel={t("settings:status.active")}
            inactiveLabel={t("settings:status.inactive")}
          />
        </div>
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
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4 py-[calc(env(safe-area-inset-top)+1.5rem)] backdrop-blur-sm"
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
      <div className="relative z-10 w-full max-w-[24rem] rounded-[34px] border border-white/[0.08] bg-[#090909]/95 p-4 shadow-[0_28px_90px_rgba(0,0,0,0.55)] sm:max-w-[27rem] sm:p-5">
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
              className="min-h-[9.4rem] rounded-[26px] border border-white/[0.08] bg-white/[0.045] px-3.5 py-4 text-left transition hover:-translate-y-0.5 hover:bg-white/[0.075] active:translate-y-0 focus:outline-none focus:ring-2 focus:ring-white/24 sm:min-h-[10rem] sm:px-4"
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
                  <span className="block min-h-8 text-[0.68rem] font-semibold uppercase leading-4 tracking-[0.11em] text-white/34">
                    {option.formula}
                  </span>
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function WorkTypeGroup({
  title,
  items,
  onSelect,
  onToggle,
  childrenByParentId,
  expandedParentIds,
  childCountLabel,
  activeLabel,
  inactiveLabel
}: {
  title: string;
  items: WorkType[];
  onSelect: (workType: WorkType) => void;
  onToggle: (workTypeId: string) => void;
  childrenByParentId: Record<string, WorkType[]>;
  expandedParentIds: Set<string>;
  childCountLabel: (count: number) => string;
  activeLabel: string;
  inactiveLabel: string;
}) {
  if (!items.length) {
    return null;
  }

  return (
    <section className="space-y-3">
      <p className="hairline-text">{title}</p>
      <div className="space-y-4">
        {items.map((item) => {
          const children = childrenByParentId[item.id] ?? [];
          const expandable = children.length > 0;
          const expanded = expandedParentIds.has(item.id);
          return (
            <div key={item.id} className="dashboard-glass-card overflow-hidden">
              <div className="flex items-stretch">
                <button
                  type="button"
                  onClick={() => expandable ? onToggle(item.id) : onSelect(item)}
                  aria-expanded={expandable ? expanded : undefined}
                  className="min-w-0 flex-1 px-5 py-5 text-left transition hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-white/24"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-4">
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: item.color }} aria-hidden="true" />
                      <div className="min-w-0">
                        <p className={`truncate text-[1.05rem] font-semibold tracking-[-0.04em] ${item.active ? "text-white" : "text-white/42"}`}>
                          {item.name}
                        </p>
                        <p className="mt-1 text-sm text-white/38">
                          {expandable ? childCountLabel(children.length) : workTypeSummary(item)}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 text-xs uppercase tracking-[0.16em] text-white/28">
                      {item.active ? activeLabel : inactiveLabel}
                    </span>
                  </div>
                </button>
                {expandable ? (
                  <>
                    <button
                      type="button"
                      onClick={() => onToggle(item.id)}
                      aria-label={expanded ? `Collapse ${item.name}` : `Expand ${item.name}`}
                      className="flex w-12 shrink-0 items-center justify-center border-l border-white/[0.06] text-white/42 transition hover:bg-white/[0.06] hover:text-white focus:outline-none focus:ring-2 focus:ring-white/24"
                    >
                      <ChevronDown className={`h-5 w-5 transition ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelect(item)}
                      aria-label={`Edit ${item.name}`}
                      className="flex w-12 shrink-0 items-center justify-center border-l border-white/[0.06] text-white/42 transition hover:bg-white/[0.06] hover:text-white focus:outline-none focus:ring-2 focus:ring-white/24"
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </>
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
                            <p className={`truncate text-sm font-semibold tracking-[-0.03em] ${child.active ? "text-white/82" : "text-white/38"}`}>
                              {child.name}
                            </p>
                            <p className="mt-0.5 text-xs text-white/34">{workTypeSummary(child)}</p>
                          </div>
                          <span className="shrink-0 text-[0.64rem] uppercase tracking-[0.14em] text-white/24">
                            {child.active ? activeLabel : inactiveLabel}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
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

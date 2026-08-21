import { useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronRight,
  Clock3,
  Folder,
  Ruler,
  Tag,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { listBusinessWorkTypes } from "../api/endpoints";
import { SettingsEmptyState } from "../components/settings/settings-empty-state";
import { SettingsPageSkeleton } from "../components/settings/settings-page-skeleton";
import { Card } from "../components/ui/card";
import { LockedModalViewport } from "../components/ui/locked-modal-viewport";
import { ModalPanel } from "../components/ui/modal-panel";
import { ScreenMessage } from "../components/ui/screen-message";
import { getApiError } from "../api/api-errors";
import { BusinessManagementShell } from "../components/business-planning/business-management-shell";
import type {
  BusinessCalculationMethod,
  BusinessWorkType,
} from "../types/business";
type Option = {
  mode: string;
  method: BusinessCalculationMethod;
  title: string;
  description: string;
  icon: ReactNode;
};
export function BusinessWorkTypesPage() {
  return <BusinessManagementShell><BusinessWorkTypesContent /></BusinessManagementShell>;
}

function BusinessWorkTypesContent() {
  const { organizationId = "" } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation("business");
  const [dialog, setDialog] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const query = useQuery({
    queryKey: ["staffing", organizationId, "types"],
    queryFn: () => listBusinessWorkTypes(organizationId),
  });
  if (query.isLoading) return <SettingsPageSkeleton />;
  if (query.error)
    return (
      <ScreenMessage
        title={t("workTypes.unavailable", {
          defaultValue: "Work types are unavailable",
        })}
        description={getApiError(query.error).message}
      />
    );
  const items = [...(query.data ?? [])].sort(
    (a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name),
  );
  const roots = items.filter((v) => !v.parentId);
  const options: Option[] = [
    {
      mode: "TIME_HOURLY",
      method: "TIME_BASED",
      title: t("workTypes.methods.TIME_BASED"),
      description: t("workTypes.methodDescriptions.TIME_BASED"),
      icon: <Clock3 className="h-5 w-5" />,
    },
    {
      mode: "UNITS_PER_HOUR",
      method: "UNITS_PER_HOUR_BASED",
      title: t("workTypes.methods.UNITS_PER_HOUR_BASED"),
      description: t("workTypes.methodDescriptions.UNITS_PER_HOUR_BASED"),
      icon: <Ruler className="h-5 w-5" />,
    },
    {
      mode: "UNITS_PER_UNIT",
      method: "UNIT_BASED",
      title: t("workTypes.methods.UNIT_BASED"),
      description: t("workTypes.methodDescriptions.UNIT_BASED"),
      icon: <Tag className="h-5 w-5" />,
    },
    {
      mode: "FIXED_AMOUNT",
      method: "FIXED_PRICE_BASED",
      title: t("workTypes.methods.FIXED_PRICE_BASED"),
      description: t("workTypes.methodDescriptions.FIXED_PRICE_BASED"),
      icon: <Tag className="h-5 w-5" />,
    },
  ];
  const open = (option: Option) =>
    navigate(`/business/${organizationId}/work-types/new?mode=${option.mode}`);
  return (
    <div className="business-admin mx-auto w-full max-w-[860px] space-y-6 pb-10">
      <header className="business-admin__header">
        <div><p>WORK TYPES</p><h1>{t("workTypes.title")}</h1><span>{t("workTypes.manageHint")}</span></div>
      </header>
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setDialog(true)}
          className="rounded-[22px] bg-emerald-400 px-4 py-3 font-bold text-emerald-950"
        >
          {t("workTypes.add")}
        </button>
        <button
          onClick={() =>
            navigate(`/business/${organizationId}/work-types/new?category=true`)
          }
          className="rounded-[22px] border border-white/10 bg-white/[0.05] px-4 py-3 font-semibold text-white"
        >
          {t("workTypes.addCategory")}
        </button>
      </div>
      {!roots.length ? (
        <SettingsEmptyState
          title={t("workTypes.empty")}
          description={t("workTypes.manageHint")}
          actionLabel={t("workTypes.add")}
          onAction={() => setDialog(true)}
        />
      ) : (
        <section className="space-y-4">
          {roots.map((item) => {
            const children = items.filter((v) => v.parentId === item.id),
              category = item.compositeEnabled,
              isExpanded = expanded.has(item.id);
            return (
              <Card key={item.id} className="overflow-hidden">
                <div className="flex items-stretch">
                  <button
                    onClick={() =>
                      navigate(
                        `/business/${organizationId}/work-types/${item.id}`,
                      )
                    }
                    className="flex min-h-[5.25rem] min-w-0 flex-1 items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-white/[0.06]"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="font-name flex items-center gap-2 truncate text-[1.05rem] font-semibold tracking-[-0.04em] text-white">
                        {category ? (
                          <Folder className="h-4 w-4 text-white/42" />
                        ) : (
                          <Tag className="h-4 w-4 text-white/42" />
                        )}
                        <span className="truncate">{item.name}</span>
                      </span>
                      <span className="mt-1 block truncate text-sm text-white/48">
                        {category
                          ? `${t("workTypes.category")} · ${children.length}`
                          : summary(item, t)}
                        {!item.active
                          ? ` · ${t("workTypes.inactive", { defaultValue: "Inactive" })}`
                          : ""}
                      </span>
                    </span>
                    {!category || !children.length ? (
                      <ChevronRight className="h-4 w-4 text-white/24" />
                    ) : null}
                  </button>
                  {category && children.length ? (
                    <button
                      onClick={() =>
                        setExpanded((current) => {
                          const next = new Set(current);
                          if (next.has(item.id)) next.delete(item.id);
                          else next.add(item.id);
                          return next;
                        })
                      }
                      className="flex w-14 items-center justify-center border-l border-white/[0.06] text-white/42"
                    >
                      <ChevronDown
                        className={`h-5 w-5 transition ${isExpanded ? "rotate-180" : ""}`}
                      />
                    </button>
                  ) : null}
                </div>
                {isExpanded ? (
                  <div className="space-y-2 border-t border-white/[0.06] bg-white/[0.025] p-3">
                    {children.map((child) => (
                      <button
                        key={child.id}
                        onClick={() =>
                          navigate(
                            `/business/${organizationId}/work-types/${child.id}`,
                          )
                        }
                        className="w-full rounded-[22px] border border-white/[0.06] bg-white/[0.035] px-4 py-3 text-left"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="flex items-center gap-2 text-sm font-semibold text-white/82">
                              <Tag className="h-3.5 w-3.5 text-white/36" />
                              {child.name}
                            </p>
                            <p className="mt-0.5 text-xs text-white/34">
                              {summary(child, t)}
                              {!child.active
                                ? ` · ${t("workTypes.inactive", { defaultValue: "Inactive" })}`
                                : ""}
                            </p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-white/24" />
                        </div>
                      </button>
                    ))}
                  </div>
                ) : null}
              </Card>
            );
          })}
        </section>
      )}
      {dialog ? (
        <LockedModalViewport
          className="z-[60] bg-black/50 px-4 py-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <button
            className="absolute inset-0"
            onClick={() => setDialog(false)}
          />
          <ModalPanel className="max-w-sm">
            <div className="mb-4 flex items-center justify-between px-1">
              <h2 className="text-[1.35rem] font-semibold tracking-[-0.06em] text-white">
                {t("workTypes.chooseMode")}
              </h2>
              <button
                onClick={() => setDialog(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-white/48"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              {options.map((option) => (
                <button
                  key={option.mode}
                  onClick={() => open(option)}
                  className="w-full rounded-[22px] border border-white/[0.08] bg-white/[0.045] p-4 text-left"
                >
                  <span className="flex items-center gap-4">
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.07] text-white/72">
                      {option.icon}
                    </span>
                    <span>
                      <span className="block text-[.95rem] font-semibold text-white">
                        {option.title}
                      </span>
                      <span className="mt-1 block text-xs leading-[1.15rem] text-white/48">
                        {option.description}
                      </span>
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </ModalPanel>
        </LockedModalViewport>
      ) : null}
    </div>
  );
}
function summary(item: BusinessWorkType, t: (key: string) => string) {
  if (item.calculationMethod === "TIME_BASED")
    return item.defaultBreakMinutes
      ? `${item.defaultBreakMinutes} min · ${t("workTypes.methods.TIME_BASED")}`
      : t("workTypes.methods.TIME_BASED");
  if (item.calculationMethod === "UNITS_PER_HOUR_BASED")
    return item.unitsPerHour
      ? `${item.unitsPerHour} / h`
      : t("workTypes.methods.UNITS_PER_HOUR_BASED");
  if (item.calculationMethod === "FIXED_PRICE_BASED")
    return t("workTypes.methods.FIXED_PRICE_BASED");
  return item.ratePerUnit && item.currency
    ? `${item.ratePerUnit} ${item.currency} / ${item.unitSymbol ?? item.unitLabel ?? "unit"}`
    : t("workTypes.methods.UNIT_BASED");
}

import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SelectedDayOverview } from "../../types/dashboard";
import { Card } from "../ui/card";

type Props = {
  selectedDay: Pick<SelectedDayOverview, "label" | "entriesCount" | "durationLabel" | "totalDuration" | "totalGross">;
  onQuickAdd: () => void;
};

/** The real Dashboard daily-summary surface, shared by production and public demos. */
export function DashboardDailySummaryCard({ selectedDay, onQuickAdd }: Props) {
  const { t } = useTranslation("dashboard");

  return <Card as="section" variant="ambient" className="dashboard-primary-card dashboard-today-card dashboard-compact-summary relative overflow-hidden px-5 py-4">
    <div className="relative grid grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)_auto] items-center gap-4">
      <div className="min-w-0">
        <p className="text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-[#f5f5f5]/34">{selectedDay.durationLabel ?? t("selectedDay.hours")}</p>
        <p className="mt-1.5 truncate font-metric text-[1.35rem] font-medium leading-none tracking-[-0.05em] text-[#f5f5f5]">{selectedDay.totalDuration || "—"}</p>
      </div>
      <span className="h-9 bg-white/[0.08]" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-[#f5f5f5]/34">{t("selectedDay.earnings")}</p>
        <p className="mt-1.5 truncate font-metric text-[1.08rem] font-medium leading-none tracking-[-0.04em] text-[#34d399]">{selectedDay.totalGross || "—"}</p>
      </div>
      <button type="button" onClick={onQuickAdd} aria-label={t("quickAdd.accessibleLabel")} className="dashboard-quick-add relative grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#34d399]/20 bg-[#10b981]/10 text-[#34d399] transition active:scale-[0.94] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#34d399]/40">
        <Plus className="h-[1.1rem] w-[1.1rem]" strokeWidth={1.9} aria-hidden="true" />
      </button>
    </div>
  </Card>;
}

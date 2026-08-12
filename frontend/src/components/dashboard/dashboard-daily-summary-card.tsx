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

  return <Card as="section" variant="ambient" className={`dashboard-today-card relative overflow-hidden px-5 ${selectedDay.entriesCount ? "py-5" : "py-4"}`}>
    <div className="pointer-events-none absolute -right-16 -top-24 h-52 w-52 rounded-full bg-[#10b981]/[0.055] blur-3xl" aria-hidden="true" />
    <div className="relative flex items-start justify-between gap-5">
      <div className="min-w-0">
        <p className="text-[0.68rem] font-medium uppercase tracking-[0.2em] text-[#10b981]/68">{selectedDay.label}</p>
      </div>
      <button type="button" onClick={onQuickAdd} aria-label={t("quickAdd.accessibleLabel")} className="dashboard-quick-add relative grid h-12 w-12 shrink-0 place-items-center rounded-full border border-[#34d399]/28 bg-[#10b981]/12 text-[#34d399] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] transition active:scale-[0.94] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#34d399]/40">
        <Plus className="h-5 w-5" strokeWidth={1.9} aria-hidden="true" />
      </button>
    </div>
    <div className="relative mt-5 grid grid-cols-2 gap-4 border-t border-[#10b981]/10 pt-4">
      <div>
        <p className="text-[0.62rem] font-medium uppercase tracking-[0.14em] text-[#f5f5f5]/34">{selectedDay.durationLabel ?? t("selectedDay.hours")}</p>
        <p className="mt-2 font-metric text-[1.65rem] font-medium leading-none tracking-[-0.055em] text-[#f5f5f5]">{selectedDay.totalDuration || "—"}</p>
      </div>
      <div className="text-right">
        <p className="text-[0.62rem] font-medium uppercase tracking-[0.14em] text-[#f5f5f5]/34">{t("selectedDay.earnings")}</p>
        <p className="mt-2 break-words font-metric text-[1.15rem] font-medium leading-none tracking-[-0.04em] text-[#34d399]">{selectedDay.totalGross || "—"}</p>
      </div>
    </div>
  </Card>;
}

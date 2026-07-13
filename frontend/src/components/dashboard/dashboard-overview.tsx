import { useTranslation } from "react-i18next";
import { RecentEntriesList } from "./recent-entries-list";
import { SummaryCards } from "./summary-cards";
import { WeeklyHoursCard } from "./weekly-hours-card";
import { SectionHeading } from "../ui/section-heading";
import type { DashboardSummaryMetrics, RecentEntry } from "../../types/dashboard";

type Props = {
  summary: DashboardSummaryMetrics | null;
  recentEntries: RecentEntry[];
  weeklyBars?: number[];
  weeklyDescription: string;
  onQuickAdd: () => void;
  onEntrySelect?: (entryId: string) => void;
  preview?: boolean;
};

export function DashboardOverview({
  summary,
  recentEntries,
  weeklyBars,
  weeklyDescription,
  onQuickAdd,
  onEntrySelect,
  preview = false
}: Props) {
  const { t } = useTranslation("dashboard");

  return (
    <div className="space-y-8 pb-6">
      <SectionHeading
        eyebrow={preview ? t("heading.previewEyebrow") : t("heading.eyebrow")}
        title={t("heading.title")}
        description={
          preview
            ? t("heading.previewDescription")
            : t("heading.description")
        }
      />
      <button
        type="button"
        onClick={onQuickAdd}
        aria-label={t("quickAdd.accessibleLabel")}
        className="surface-muted flex w-full items-center justify-between px-5 py-4 text-left transition focus:outline-none focus:ring-2 focus:ring-white/24 hover:bg-white/[0.05]"
      >
        <div>
          <p className="hairline-text">{t("quickAdd.eyebrow")}</p>
          <p className="mt-2 text-[1.15rem] font-semibold tracking-[-0.05em] text-white">
            {t("quickAdd.description")}
          </p>
        </div>
        <span className="rounded-full border border-white/[0.08] bg-white/[0.92] px-4 py-2 text-sm font-semibold text-black shadow-[0_10px_24px_rgba(0,0,0,0.28)]">
          {t("quickAdd.cta")}
        </span>
      </button>
      <SummaryCards metrics={summary} />
      <RecentEntriesList
        entries={recentEntries}
        emptyMessage={t("recentEntries.emptyDescription")}
        onEntrySelect={onEntrySelect}
      />
      <WeeklyHoursCard
        bars={weeklyBars}
        description={weeklyDescription}
      />
    </div>
  );
}

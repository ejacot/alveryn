import { useTranslation } from "react-i18next";
import { RecentEntriesList } from "./recent-entries-list";
import { SummaryCards } from "./summary-cards";
import { WeeklyHoursCard } from "./weekly-hours-card";
import { SectionHeading } from "../ui/section-heading";
import type {
  DashboardSummaryMetrics,
  RecentEntry,
  SelectedDayOverview
} from "../../types/dashboard";

type Props = {
  summary: DashboardSummaryMetrics | null;
  recentEntries: RecentEntry[];
  selectedDay: SelectedDayOverview;
  weeklyBars?: number[];
  weeklyDescription: string;
  onQuickAdd: () => void;
  onEntrySelect?: (entryId: string) => void;
  preview?: boolean;
};

export function DashboardOverview({
  summary,
  recentEntries,
  selectedDay,
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
        title={selectedDay.label}
        description={
          preview
            ? t("heading.previewDescription")
            : selectedDay.entriesCount
              ? t("heading.activityDescription", { count: selectedDay.entriesCount })
              : t("heading.emptyDescription")
        }
      />
      <SelectedDayPanel
        selectedDay={selectedDay}
        onEntrySelect={onEntrySelect}
        onQuickAdd={onQuickAdd}
      />
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

function SelectedDayPanel({
  selectedDay,
  onEntrySelect,
  onQuickAdd
}: {
  selectedDay: SelectedDayOverview;
  onEntrySelect?: (entryId: string) => void;
  onQuickAdd: () => void;
}) {
  const { t } = useTranslation("dashboard");

  if (!selectedDay.entriesCount) {
    return (
      <button
        type="button"
        onClick={onQuickAdd}
        aria-label={t("quickAdd.accessibleLabel")}
        className="surface-muted flex w-full items-center justify-between px-5 py-4 text-left transition focus:outline-none focus:ring-2 focus:ring-white/24 hover:bg-white/[0.05]"
      >
        <div>
          <p className="hairline-text">{t("quickAdd.eyebrow")}</p>
          <p className="mt-2 text-[1.15rem] font-semibold tracking-[-0.05em] text-white">
            {t("quickAdd.emptyDescription")}
          </p>
        </div>
        <span className="rounded-full border border-white/[0.08] bg-white/[0.92] px-4 py-2 text-sm font-semibold text-black shadow-[0_10px_24px_rgba(0,0,0,0.28)]">
          {t("quickAdd.cta")}
        </span>
      </button>
    );
  }

  const primary = selectedDay.activities[0];
  const multiple = selectedDay.entriesCount > 1;

  return (
    <section className="surface-muted space-y-4 px-5 py-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="hairline-text">
            {multiple
              ? t("selectedDay.activities", { count: selectedDay.entriesCount })
              : t("selectedDay.activity")}
          </p>
          <h2 className="mt-2 text-[1.35rem] font-semibold tracking-[-0.05em] text-white">
            {multiple ? t("selectedDay.activities", { count: selectedDay.entriesCount }) : primary.title}
          </h2>
        </div>
        <button
          type="button"
          onClick={onQuickAdd}
          className="rounded-full border border-white/[0.08] bg-white/[0.08] px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.12]"
        >
          {t("quickAdd.cta")}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.035] px-4 py-3">
          <p className="text-xs uppercase tracking-[0.16em] text-white/34">{t("selectedDay.totalTime")}</p>
          <p className="mt-2 text-lg font-semibold text-white">{selectedDay.totalDuration}</p>
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.035] px-4 py-3">
          <p className="text-xs uppercase tracking-[0.16em] text-white/34">{t("selectedDay.gross")}</p>
          <p className="mt-2 text-lg font-semibold text-white">{selectedDay.totalGross}</p>
        </div>
      </div>

      <div className="space-y-3">
        {selectedDay.activities.map((activity) => (
          <button
            key={activity.id}
            type="button"
            onClick={() => onEntrySelect?.(activity.id)}
            className="w-full rounded-[24px] border border-white/[0.05] bg-white/[0.035] px-4 py-4 text-left transition hover:bg-white/[0.055] focus:outline-none focus:ring-2 focus:ring-white/24"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold tracking-[-0.03em] text-white">{activity.title}</p>
                <p className="mt-1 text-sm text-white/52">{activity.subtitle}</p>
              </div>
              <p className="text-sm font-semibold text-white/90">{activity.amount}</p>
            </div>
            {activity.unitBreakdown.length ? (
              <div className="mt-3 space-y-1">
                {activity.unitBreakdown.map((line) => (
                  <p key={line} className="text-sm text-white/62">{line}</p>
                ))}
              </div>
            ) : null}
            <p className="mt-3 text-sm text-white/40">{activity.duration}</p>
          </button>
        ))}
      </div>
    </section>
  );
}

import { RecentEntriesList } from "./recent-entries-list";
import { SummaryCards } from "./summary-cards";
import { WeeklyHoursCard } from "./weekly-hours-card";
import { SectionHeading } from "../ui/section-heading";
import type { RecentEntry, SummaryMetric } from "../../types/dashboard";

type Props = {
  summary: SummaryMetric[];
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
  return (
    <div className="space-y-5 pb-6">
      <SectionHeading
        eyebrow={preview ? "Preview" : "Overview"}
        title="Today feels under control."
        description={
          preview
            ? "Explicit local preview data for the approved Roomly visual language."
            : "Live backend data, clean hierarchy, and no fake success fallbacks."
        }
      />
      <button
        type="button"
        onClick={onQuickAdd}
        className="section-card flex w-full items-center justify-between bg-white/[0.09] text-left transition focus:outline-none focus:ring-2 focus:ring-white/28 hover:bg-white/[0.11]"
      >
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-white/48">
            Quick Add
          </p>
          <p className="mt-2 text-lg font-semibold text-white">Save today&apos;s shift fast.</p>
        </div>
        <span className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black">
          Add Entry
        </span>
      </button>
      <SummaryCards items={summary} />
      <RecentEntriesList
        entries={recentEntries}
        emptyMessage="No entries yet for this period."
        onEntrySelect={onEntrySelect}
      />
      <WeeklyHoursCard
        bars={weeklyBars}
        description={weeklyDescription}
      />
    </div>
  );
}

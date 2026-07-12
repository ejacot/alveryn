import { RecentEntriesList } from "./recent-entries-list";
import { SummaryCards } from "./summary-cards";
import { WeeklyHoursCard } from "./weekly-hours-card";
import { SectionHeading } from "../ui/section-heading";
import type { RecentEntry, SummaryMetric } from "../../types/dashboard";

type Props = {
  summary: SummaryMetric[];
  recentEntries: RecentEntry[];
  weeklyBars?: number[];
  preview?: boolean;
};

export function DashboardOverview({
  summary,
  recentEntries,
  weeklyBars,
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
      <SummaryCards items={summary} />
      <RecentEntriesList
        entries={recentEntries}
        emptyMessage="No entries yet for this period."
      />
      <WeeklyHoursCard
        bars={weeklyBars}
        description={
          preview
            ? "Preview-only rhythm bars for local design validation."
            : "Weekly hours visualization will connect to live calendar analytics in the next milestone."
        }
      />
    </div>
  );
}

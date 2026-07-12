import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getDashboard, getWorkEntries } from "../api/endpoints";
import { RecentEntriesList } from "../components/dashboard/recent-entries-list";
import { SummaryCards } from "../components/dashboard/summary-cards";
import { WeeklyHoursCard } from "../components/dashboard/weekly-hours-card";
import { SectionHeading } from "../components/ui/section-heading";
import type { RecentEntry, SummaryMetric } from "../types/dashboard";

const fallbackSummary: SummaryMetric[] = [
  { label: "Today", value: "6.5h", hint: "Focused shift" },
  { label: "Earnings", value: "€126", hint: "Projected gross" },
  { label: "Week", value: "31.0h", hint: "Steady rhythm" },
  { label: "Entries", value: "5", hint: "Recent activity" }
];

const fallbackEntries: RecentEntry[] = [
  {
    id: "1",
    title: "Morning rooms",
    subtitle: "Housekeeping • 08:00 - 14:30",
    amount: "6.5h"
  },
  {
    id: "2",
    title: "Late shift",
    subtitle: "Lobby reset • Yesterday",
    amount: "4.0h"
  },
  {
    id: "3",
    title: "Weekend prep",
    subtitle: "Suite touch-up • Fri",
    amount: "3.5h"
  }
];

export function DashboardPage() {
  const { data: dashboard } = useQuery({
    queryKey: ["dashboard"],
    queryFn: getDashboard
  });

  const { data: workEntries } = useQuery({
    queryKey: ["work-entries", "recent"],
    queryFn: getWorkEntries
  });

  const summary = useMemo<SummaryMetric[]>(() => {
    if (
      dashboard &&
      typeof dashboard === "object" &&
      dashboard !== null &&
      "workedHours" in dashboard
    ) {
      const data = dashboard as Record<string, string | number>;
      return [
        {
          label: "Today",
          value: `${data.workedHours ?? "0"}h`,
          hint: "Live backend summary"
        },
        {
          label: "Gross",
          value: `${data.grossAmount ?? 0}`,
          hint: "Current month"
        },
        {
          label: "Entries",
          value: `${data.entriesCount ?? 0}`,
          hint: "Tracked this month"
        },
        {
          label: "Absence",
          value: `${data.absenceDays ?? 0}`,
          hint: "Days this month"
        }
      ];
    }

    return fallbackSummary;
  }, [dashboard]);

  const recentEntries = useMemo<RecentEntry[]>(() => {
    if (workEntries?.content?.length) {
      return workEntries.content.slice(0, 3).map((entry, index) => ({
        id: `${index}`,
        title:
          typeof entry === "object" && entry && "workTypeName" in entry
            ? String((entry as Record<string, unknown>).workTypeName)
            : "Tracked entry",
        subtitle:
          typeof entry === "object" && entry && "workDate" in entry
            ? String((entry as Record<string, unknown>).workDate)
            : "Backend data",
        amount:
          typeof entry === "object" && entry && "workedHours" in entry
            ? `${String((entry as Record<string, unknown>).workedHours)}h`
            : "Saved"
      }));
    }

    return fallbackEntries;
  }, [workEntries]);

  return (
    <div className="space-y-5 pb-6">
      <SectionHeading
        eyebrow="Overview"
        title="Today feels under control."
        description="A soft dashboard structure with live-ready data hooks, premium spacing, and space for the future analytics surface."
      />
      <SummaryCards items={summary} />
      <RecentEntriesList entries={recentEntries} />
      <WeeklyHoursCard />
    </div>
  );
}

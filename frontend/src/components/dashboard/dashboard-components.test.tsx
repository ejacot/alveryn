import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DashboardOverview } from "./dashboard-overview";
import { RecentEntriesList } from "./recent-entries-list";
import { SummaryCards } from "./summary-cards";
import { WeeklyHoursCard } from "./weekly-hours-card";
import { i18n } from "../../i18n";
import type { DashboardSummaryMetrics } from "../../types/dashboard";

const baseSummary: DashboardSummaryMetrics = {
  primaryMetric: {
    label: "Today",
    value: "8h 00m",
    hint: "1 tracked entry"
  },
  secondaryMetrics: [
    {
      label: "Gross",
      value: "EUR 160.00",
      hint: "Live from saved entries"
    },
    {
      label: "Week",
      value: "32h 00m",
      hint: "4 entries this week"
    }
  ],
  tertiaryMetric: {
    label: "Recent",
    value: "5",
    hint: "Loaded from real backend data"
  }
};

describe("dashboard components", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("renders localized dashboard overview and quick add CTA", async () => {
    const onQuickAdd = vi.fn();
    const user = userEvent.setup();

    render(
      <DashboardOverview
        summary={baseSummary}
        recentEntries={[]}
        weeklyBars={[]}
        weeklyDescription="No entries saved for this week yet."
        onQuickAdd={onQuickAdd}
      />
    );

    expect(screen.getByText("Today at a glance")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add a new work entry" })).toBeInTheDocument();
    expect(screen.getByText("Add entry")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add a new work entry" }));
    expect(onQuickAdd).toHaveBeenCalledTimes(1);
  });

  it("renders passive recent-entry header affordance and empty state", () => {
    render(<RecentEntriesList entries={[]} />);

    expect(screen.getByText("Latest")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /see all/i })).not.toBeInTheDocument();
    expect(screen.getByText("No entries yet")).toBeInTheDocument();
  });

  it("renders populated recent entries", () => {
    render(
      <RecentEntriesList
        entries={[
          {
            id: "entry-1",
            title: "Regular Shift",
            subtitle: "08:00 - 16:00",
            duration: "8h 00m",
            amount: "EUR 160.00"
          }
        ]}
      />
    );

    expect(screen.getByRole("button", { name: "Open Regular Shift" })).toBeInTheDocument();
  });

  it("does not crash without metrics and renders one metric safely", () => {
    const { rerender } = render(<SummaryCards metrics={null} />);
    expect(screen.queryByText("Today")).not.toBeInTheDocument();

    rerender(
      <SummaryCards
        metrics={{
          primaryMetric: {
            label: "Today",
            value: "8h 00m",
            hint: "1 tracked entry"
          }
        }}
      />
    );

    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText("8h 00m")).toBeInTheDocument();
  });

  it("renders the expected dashboard metric structure", () => {
    render(<SummaryCards metrics={baseSummary} />);

    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText("Gross")).toBeInTheDocument();
    expect(screen.getByText("Week")).toBeInTheDocument();
    expect(screen.getByText("Recent")).toBeInTheDocument();
  });

  it("renders every provided secondary metric without silently ignoring extras", () => {
    render(
      <SummaryCards
        metrics={{
          primaryMetric: {
            label: "Today",
            value: "8h 00m",
            hint: "1 tracked entry"
          },
          secondaryMetrics: [
            { label: "Gross", value: "EUR 160.00", hint: "Saved" },
            { label: "Week", value: "32h 00m", hint: "4 entries this week" },
            { label: "Absence", value: "0", hint: "No absences" }
          ]
        }}
      />
    );

    expect(screen.getByText("Absence")).toBeInTheDocument();
  });

  it("renders localized weekly-hours empty state and chart", async () => {
    const { rerender } = render(<WeeklyHoursCard bars={[]} description="Weekly summary." />);
    expect(
      screen.getByText("Weekly activity will appear after you save work this week.")
    ).toBeInTheDocument();

    await act(async () => {
      await i18n.changeLanguage("de");
    });
    rerender(<WeeklyHoursCard bars={[20, 40, 60]} description="Wochenuberblick." />);
    expect(screen.getByText("Wochenstunden")).toBeInTheDocument();
  });
});

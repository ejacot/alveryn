import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DashboardOverview } from "./dashboard-overview";
import { SummaryCards } from "./summary-cards";
import { WeeklyHoursCard } from "./weekly-hours-card";
import { i18n } from "../../i18n";
import type {
  DashboardSummaryMetrics,
  SelectedDayOverview,
  WeeklyRhythmDay
} from "../../types/dashboard";

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
      hint: "This day"
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
    hint: "All saved entries"
  }
};
const baseSelectedDay: SelectedDayOverview = {
  label: "Today",
  entriesCount: 0,
  totalDuration: "0h 00m",
  totalGross: "EUR 0.00",
  activities: []
};
const weeklyDays: WeeklyRhythmDay[] = [
  {
    key: "2026-07-13",
    label: "Mon",
    value: "0h 00m",
    markerLabel: null,
    status: "idle",
    percentage: 0,
    selected: false
  },
  {
    key: "2026-07-14",
    label: "Tue",
    value: "4h 00m",
    markerLabel: "-4",
    status: "under",
    percentage: 50,
    selected: false
  },
  {
    key: "2026-07-15",
    label: "Wed",
    value: "8h 00m",
    markerLabel: null,
    status: "met",
    percentage: 100,
    selected: true
  }
];

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
        selectedDay={baseSelectedDay}
        weeklyDays={[]}
        onQuickAdd={onQuickAdd}
        onCreateAbsence={vi.fn()}
      />
    );

    expect(screen.queryByRole("heading", { name: "Today" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add a new work entry" })).toBeInTheDocument();
    expect(screen.getByText("Add entry")).toBeInTheDocument();
    expect(screen.queryByText("No activity yet")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add a new work entry" }));
    expect(onQuickAdd).toHaveBeenCalledTimes(1);
  });

  it("shows absence choices only when the selected day has no activity", async () => {
    const onCreateAbsence = vi.fn();
    const user = userEvent.setup();

    render(
      <DashboardOverview
        summary={baseSummary}
        selectedDay={baseSelectedDay}
        weeklyDays={[]}
        onQuickAdd={vi.fn()}
        onCreateAbsence={onCreateAbsence}
      />
    );

    await user.click(screen.getByRole("button", { name: "Absence" }));
    await user.click(screen.getByRole("button", { name: "Sick" }));
    expect(onCreateAbsence).toHaveBeenCalledWith("SICK_LEAVE");
  });

  it("hides absence action when the selected day already has activity", () => {
    render(
      <DashboardOverview
        summary={baseSummary}
        selectedDay={{
          ...baseSelectedDay,
          entriesCount: 1,
          activities: [
            {
              id: "entry-1",
              title: "Regular Shift",
              kind: "TIME_BASED",
              subtitle: "08:00 – 16:00",
              duration: "7h 30m worked",
              amount: "€150.00",
              unitBreakdown: []
            }
          ]
        }}
        weeklyDays={[]}
        onQuickAdd={vi.fn()}
        onCreateAbsence={vi.fn()}
      />
    );

    expect(screen.queryByRole("button", { name: "Absence" })).not.toBeInTheDocument();
  });

  it("renders absence as a day activity item", () => {
    render(
      <DashboardOverview
        summary={baseSummary}
        selectedDay={{
          ...baseSelectedDay,
          entriesCount: 1,
          activities: [
            {
              id: "absence-1",
              title: "Vacation",
              kind: "ABSENCE",
              subtitle: "Day off",
              duration: "No work planned",
              amount: "",
              marker: "vacation",
              unitBreakdown: []
            }
          ]
        }}
        weeklyDays={[]}
        onQuickAdd={vi.fn()}
        onCreateAbsence={vi.fn()}
      />
    );

    expect(screen.getByText("Vacation")).toBeInTheDocument();
    expect(screen.getByText("Day off")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /vacation/i })).not.toBeInTheDocument();
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
    const { rerender } = render(<WeeklyHoursCard days={[]} />);
    expect(screen.queryByText("Weekly hours")).not.toBeInTheDocument();

    await act(async () => {
      await i18n.changeLanguage("de");
    });
    rerender(<WeeklyHoursCard days={weeklyDays} />);
    expect(screen.queryByText("Wochenstunden")).not.toBeInTheDocument();
    expect(screen.getByText("Wed")).toBeInTheDocument();
    expect(screen.queryByText("8")).not.toBeInTheDocument();
    expect(screen.getByText("-4")).toBeInTheDocument();
    expect(screen.queryByText("8h 00m")).not.toBeInTheDocument();
  });
});

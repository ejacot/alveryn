import { fireEvent, render, screen } from "@testing-library/react";
import { StatisticsLineChart } from "./statistics-line-chart";
import type { StatisticsAdvancedComparison, StatisticsTimeSeriesPoint } from "../types/statistics";

const points: StatisticsTimeSeriesPoint[] = [
  {
    bucketStart: "2026-08-01",
    bucketEnd: "2026-08-01",
    value: "5",
    metric: "ENTRIES",
    currency: null
  },
  {
    bucketStart: "2026-08-02",
    bucketEnd: "2026-08-02",
    value: "7",
    metric: "ENTRIES",
    currency: null
  }
];

describe("StatisticsLineChart", () => {
  it("shows a value only after its chart interval is selected", () => {
    const onPointSelect = vi.fn();
    const { rerender } = render(
      <StatisticsLineChart
        points={points}
        metric="ENTRIES"
        granularity="DAILY"
        onPointSelect={onPointSelect}
      />
    );

    expect(screen.getByRole("heading", { name: "Entries" })).toBeInTheDocument();
    expect(screen.getByText("Aug 1 – Aug 2 2026")).toBeInTheDocument();
    expect(screen.queryByText("Selected period")).not.toBeInTheDocument();
    expect(screen.queryByText("5")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "1: 5" }));

    expect(screen.getByText("5")).toBeInTheDocument();
    expect(onPointSelect).toHaveBeenCalledWith(points[0]);

    rerender(
      <StatisticsLineChart
        points={[...points]}
        metric="ENTRIES"
        granularity="DAILY"
        onPointSelect={onPointSelect}
      />
    );
    expect(screen.getByText("5")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "1: 5" }));
    expect(screen.queryByText("5")).not.toBeInTheDocument();
    expect(onPointSelect).toHaveBeenLastCalledWith(null);
  });

  it("keeps every day selectable for a 31-day period", () => {
    const month = Array.from({ length: 31 }, (_, index): StatisticsTimeSeriesPoint => ({
      bucketStart: `2026-07-${String(index + 1).padStart(2, "0")}`,
      bucketEnd: `2026-07-${String(index + 1).padStart(2, "0")}`,
      value: String(index + 1),
      metric: "ENTRIES",
      currency: null
    }));

    render(
      <StatisticsLineChart
        points={month}
        metric="ENTRIES"
        granularity="DAILY"
      />
    );

    expect(screen.getAllByRole("button", { name: /^\d+: \d+$/ })).toHaveLength(31);
  });

  it("updates current, previous, change and percentage for a selected comparison point", () => {
    const period = {
      from: "2026-01-01",
      to: "2026-12-31",
      workedMinutes: "0",
      workedDays: 0,
      entries: 0,
      grossByCurrency: [{ currency: "EUR", amount: "100" }],
      averageMinutesPerWorkedDay: "0"
    };
    const comparison: StatisticsAdvancedComparison = {
      metric: "GROSS",
      periodA: period,
      periodB: { ...period, from: "2025-01-01", to: "2025-12-31" },
      differences: [{
        currency: "EUR",
        periodAValue: "100",
        periodBValue: "80",
        absolute: "20",
        percentage: "25",
        direction: "UP",
        available: true
      }],
      series: {
        alignment: "MONTH_OF_YEAR",
        granularity: "MONTHLY",
        points: [{
          label: "JUNE",
          periodABucketStart: "2026-06-01",
          periodABucketEnd: "2026-06-30",
          periodBBucketStart: "2025-06-01",
          periodBBucketEnd: "2025-06-30",
          periodAValue: "4100",
          periodBValue: "3400",
          currency: "EUR"
        }]
      }
    };
    const onPointSelect = vi.fn();
    const onComparisonPeriodBChange = vi.fn();

    render(
      <StatisticsLineChart
        points={points}
        comparison={comparison}
        metric="GROSS"
        granularity="MONTHLY"
        onPointSelect={onPointSelect}
        comparisonPeriod="custom"
        onComparisonPeriodBChange={onComparisonPeriodBChange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Compare" }));
    expect(screen.getByRole("heading", { name: "2026 vs. 2025" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Year"), {
      target: { value: "2024" }
    });
    expect(onComparisonPeriodBChange).toHaveBeenCalledWith({
      from: "2024-01-01",
      to: "2024-12-31"
    });
    fireEvent.click(screen.getByRole("button", { name: /JUNE:/ }));

    expect(screen.getByText("€4,100.00")).toBeInTheDocument();
    expect(screen.getByText("€3,400.00")).toBeInTheDocument();
    expect(screen.getByText("€700.00")).toBeInTheDocument();
    expect(screen.getByText("+20.6%")).toBeInTheDocument();
    expect(onPointSelect).not.toHaveBeenCalled();

    fireEvent.pointerDown(document.body);
    expect(screen.getByText("€700.00")).toBeInTheDocument();

    fireEvent.click(document.body);

    expect(screen.queryByText("€700.00")).not.toBeInTheDocument();
    expect(screen.getAllByText("€100.00")).not.toHaveLength(0);
  });
});

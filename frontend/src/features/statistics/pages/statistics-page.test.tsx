import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { StatisticsPage } from "./statistics-page";

vi.mock("../../../api/endpoints", () => ({
  listWorkTypes: vi.fn(),
  listWorkEntriesForDay: vi.fn()
}));

vi.mock("../api/statistics-api", () => ({
  getStatisticsOverview: vi.fn(),
  getStatisticsTimeSeries: vi.fn(),
  getStatisticsWorkTypes: vi.fn(),
  getStatisticsHeatmap: vi.fn(),
  getStatisticsComparison: vi.fn(),
  getStatisticsDrilldown: vi.fn(),
  getStatisticsForecast: vi.fn(),
  getStatisticsProductivity: vi.fn(),
  getStatisticsHighlights: vi.fn(),
  getStatisticsInsights: vi.fn()
}));

import { listWorkTypes } from "../../../api/endpoints";
import {
  getStatisticsComparison,
  getStatisticsDrilldown,
  getStatisticsForecast,
  getStatisticsHeatmap,
  getStatisticsHighlights,
  getStatisticsInsights,
  getStatisticsOverview,
  getStatisticsProductivity,
  getStatisticsTimeSeries,
  getStatisticsWorkTypes
} from "../api/statistics-api";

const overview = {
  grossByCurrency: [{ currency: "EUR", amount: "3482.00" }],
  workedMinutes: "4320",
  workedDays: 12,
  entries: 18,
  averageMinutesPerDay: "360",
  comparison: {
    available: true,
    percentage: "18.00",
    direction: "UP" as const,
    grossByCurrency: [{ currency: "EUR", amount: "2950.00" }]
  }
};

function renderPage(initialEntries = ["/statistics"]) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  });

  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <QueryClientProvider client={queryClient}>
        <StatisticsPage />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("StatisticsPage", () => {
  beforeEach(() => {
    vi.mocked(listWorkTypes).mockResolvedValue([
      {
        id: "work-type-check",
        name: "Check",
        calculationMethod: "TIME_BASED",
        color: "#FFFFFF",
        icon: null,
        defaultBreakMinutes: 30,
        displayOrder: 0,
        active: true
      }
    ]);
    vi.mocked(getStatisticsOverview).mockResolvedValue(overview);
    vi.mocked(getStatisticsTimeSeries).mockResolvedValue({
      granularity: "DAILY",
      metric: "GROSS",
      points: [
        { bucketStart: "2026-07-01", bucketEnd: "2026-07-01", value: "1200", metric: "GROSS", currency: "EUR" },
        { bucketStart: "2026-07-02", bucketEnd: "2026-07-02", value: "0", metric: "GROSS", currency: "EUR" },
        { bucketStart: "2026-07-03", bucketEnd: "2026-07-03", value: "2282", metric: "GROSS", currency: "EUR" }
      ]
    });
    vi.mocked(getStatisticsWorkTypes).mockResolvedValue([
      {
        workTypeId: "work-type-check",
        name: "Check",
        calculationMethod: "TIME_BASED",
        minutes: "4320",
        grossByCurrency: [{ currency: "EUR", amount: "3482" }],
        percentage: "100",
        percentageBasis: "MINUTES",
        entries: 18
      }
    ]);
    vi.mocked(getStatisticsHeatmap).mockResolvedValue({
      metric: "WORKED_HOURS",
      currency: null,
      minimum: "0",
      maximum: "480",
      days: [
        {
          date: "2026-07-01",
          value: "480",
          workedMinutes: "480",
          entries: 1,
          grossByCurrency: [{ currency: "EUR", amount: "160" }],
          hasAbsence: false
        }
      ]
    });
    vi.mocked(getStatisticsComparison).mockResolvedValue({
      metric: "GROSS",
      periodA: {
        from: "2026-07-01",
        to: "2026-07-31",
        workedMinutes: "4320",
        workedDays: 12,
        entries: 18,
        grossByCurrency: [{ currency: "EUR", amount: "3482" }],
        averageMinutesPerWorkedDay: "360"
      },
      periodB: {
        from: "2026-06-01",
        to: "2026-06-30",
        workedMinutes: "3600",
        workedDays: 10,
        entries: 14,
        grossByCurrency: [{ currency: "EUR", amount: "2950" }],
        averageMinutesPerWorkedDay: "360"
      },
      differences: [
        {
          currency: "EUR",
          periodAValue: "3482",
          periodBValue: "2950",
          absolute: "532",
          percentage: "18.03",
          direction: "UP",
          available: true
        }
      ],
      series: {
        alignment: "RELATIVE_DAY",
        granularity: "DAILY",
        points: []
      }
    });
    vi.mocked(getStatisticsDrilldown).mockResolvedValue({
      from: "2026-07-01",
      to: "2026-07-01",
      totals: {
        from: "2026-07-01",
        to: "2026-07-01",
        workedMinutes: "480",
        workedDays: 1,
        entries: 1,
        grossByCurrency: [{ currency: "EUR", amount: "160" }],
        averageMinutesPerWorkedDay: "480"
      },
      workTypes: []
    });
    vi.mocked(getStatisticsForecast).mockResolvedValue({
      from: "2026-07-01",
      to: "2026-07-31",
      asOf: "2026-07-14",
      mode: "WORKDAY_PACE",
      forecasts: [
        {
          currency: "EUR",
          actualGross: "2480",
          projectedGross: "3720",
          lowerBound: "3480",
          upperBound: "3910",
          workedDays: 10,
          elapsedEligibleDays: 10,
          remainingEligibleDays: 12,
          observedWorkFrequency: "0.71",
          expectedRemainingWorkedDays: "8.52",
          todayIncludedInElapsed: false,
          calculationBasis: "OBSERVED_WORKDAY_FREQUENCY",
          sampleSize: 12,
          recentWindowStart: null,
          recentWindowEnd: null,
          recentEligibleDays: 0,
          recentWorkedDays: 0,
          recentWorkFrequency: "0",
          averageGrossPerWorkedDay: "248",
          confidence: "MEDIUM",
          available: true,
          reason: null
        }
      ]
    });
    vi.mocked(getStatisticsProductivity).mockResolvedValue({
      totalUnits: "482",
      equivalentMinutes: "10360",
      actualMinutes: null,
      effectiveConfiguredUnitsPerHour: "2.79",
      actualUnitsPerHour: null,
      performancePercentage: null,
      actualProductivityAvailable: false,
      available: true,
      partial: false,
      incompleteItems: 0,
      unitTypes: [
        {
          unitTypeId: "unit-normal",
          name: "Normal rooms",
          workTypeName: "Rooms",
          totalQuantity: "326",
          equivalentMinutes: "8150",
          actualMinutes: null,
          configuredUnitsPerHour: "2.4",
          actualUnitsPerHour: null,
          performancePercentage: null,
          actualProductivityAvailable: false,
          entries: 8,
          percentageOfTotalUnits: "67.63"
        }
      ],
      grouping: "TOTAL",
      granularity: "DAILY",
      metric: "TOTAL_UNITS",
      points: []
    });
    vi.mocked(getStatisticsHighlights).mockResolvedValue({
      highlights: [
        {
          type: "CURRENT_STREAK",
          available: true,
          label: null,
          value: null,
          from: "2026-07-09",
          to: "2026-07-14",
          numericValue: "6",
          currency: null,
          grossByCurrency: []
        }
      ]
    });
    vi.mocked(getStatisticsInsights).mockResolvedValue({
      insights: [
        {
          type: "HOURS_CHANGE",
          direction: "UP",
          percentage: "18.2",
          currentValue: "176",
          previousValue: "149",
          currency: null,
          subject: null,
          severity: "POSITIVE",
          confidence: "HIGH"
        }
      ]
    });
  });

  it("renders backend summary, chart and breakdown", async () => {
    renderPage();

    expect(await screen.findAllByText("€3,482")).toHaveLength(2);
    expect(screen.getByText("+18%")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Statistics trend chart" })).toBeInTheDocument();
    expect(screen.getAllByText("Check")).toHaveLength(2);
    expect(screen.getByText("72h · 100%")).toBeInTheDocument();
    expect(screen.getAllByText("€3,482")).toHaveLength(2);
    expect(screen.getByText("Activity heatmap")).toBeInTheDocument();
    expect(screen.getByText("Compare periods")).toBeInTheDocument();
  });

  it("renders V2B forecast, productivity, highlights and insights", async () => {
    renderPage();

    expect(await screen.findByText("What changed")).toBeInTheDocument();
    expect(screen.getByText("You worked +18% more hours than the previous period.")).toBeInTheDocument();
    expect(await screen.findByText("Estimated end of period")).toBeInTheDocument();
    expect(getStatisticsForecast).toHaveBeenCalled();
    expect(screen.getByText("Unit productivity")).toBeInTheDocument();
    expect(screen.getByText("Normal rooms")).toBeInTheDocument();
    expect(screen.getByText("Personal performance")).toBeInTheDocument();
    expect(screen.getByText("Current streak")).toBeInTheDocument();
  });

  it("refetches statistics when filters change", async () => {
    renderPage();
    const user = userEvent.setup();

    await screen.findAllByText("€3,482");
    const filterControls = within(screen.getByLabelText("Statistics filters")).getAllByRole("combobox");
    await user.selectOptions(filterControls[1], "WORKED_HOURS");
    await waitFor(() => expect(getStatisticsOverview).toHaveBeenCalledWith(expect.objectContaining({ metric: "WORKED_HOURS" })));
  });

  it("persists productivity controls and requests the selected contract", async () => {
    renderPage();
    const user = userEvent.setup();

    await screen.findByText("Unit productivity");
    await user.selectOptions(screen.getByLabelText("Productivity value"), "EQUIVALENT_MINUTES");
    await user.selectOptions(screen.getByLabelText("Grouping"), "WEEKLY");

    await waitFor(() => {
      expect(getStatisticsProductivity).toHaveBeenCalledWith(
        expect.anything(),
        "EQUIVALENT_MINUTES",
        "WEEKLY"
      );
    });
  });

  it("shows the empty state when the backend has no entries", async () => {
    vi.mocked(getStatisticsOverview).mockResolvedValueOnce({
      ...overview,
      grossByCurrency: [],
      workedMinutes: "0",
      workedDays: 0,
      entries: 0,
      averageMinutesPerDay: "0",
      comparison: {
        available: false,
        percentage: null,
        direction: "NO_DATA",
        grossByCurrency: []
      }
    });
    vi.mocked(getStatisticsTimeSeries).mockResolvedValueOnce({
      granularity: "DAILY",
      metric: "GROSS",
      points: []
    });
    vi.mocked(getStatisticsWorkTypes).mockResolvedValueOnce([]);

    renderPage();

    expect(await screen.findByText("No statistics yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Entry" })).toBeInTheDocument();
  });

  it("renders mixed currencies separately and avoids fake combined totals", async () => {
    vi.mocked(getStatisticsOverview).mockResolvedValueOnce({
      ...overview,
      grossByCurrency: [
        { currency: "EUR", amount: "3482" },
        { currency: "CHF", amount: "420" }
      ],
      comparison: {
        available: false,
        percentage: null,
        direction: "NEW",
        grossByCurrency: []
      }
    });

    renderPage();

    expect(await screen.findByText("EUR")).toBeInTheDocument();
    expect(screen.getByText("CHF")).toBeInTheDocument();
    expect(screen.getAllByText("€3,482")).toHaveLength(2);
    expect(screen.getByText(/CHF\s*420/)).toBeInTheDocument();
    expect(screen.getByText("No previous period available.")).toBeInTheDocument();
  });

  it("uses an explicit heatmap metric instead of falling back from the trend metric", async () => {
    renderPage(["/statistics?metric=GROSS"]);
    const user = userEvent.setup();

    await screen.findByText("Activity heatmap");
    await waitFor(() => {
      expect(getStatisticsHeatmap).toHaveBeenCalledWith(
        expect.objectContaining({ metric: "GROSS" }),
        "WORKED_HOURS",
        null
      );
    });

    await user.selectOptions(screen.getByLabelText("Heatmap metric"), "GROSS");

    await waitFor(() => {
      expect(getStatisticsHeatmap).toHaveBeenCalledWith(
        expect.objectContaining({ metric: "GROSS" }),
        "GROSS",
        null
      );
    });
  });

  it("restores heatmap metric and currency from the URL", async () => {
    renderPage(["/statistics?heatmapMetric=GROSS&heatmapCurrency=EUR"]);

    await screen.findByText("Activity heatmap");

    await waitFor(() => {
      expect(getStatisticsHeatmap).toHaveBeenCalledWith(
        expect.any(Object),
        "GROSS",
        "EUR"
      );
    });
  });
});

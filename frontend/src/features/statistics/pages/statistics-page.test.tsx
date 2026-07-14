import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { StatisticsPage } from "./statistics-page";

vi.mock("../../../api/endpoints", () => ({
  listWorkTypes: vi.fn()
}));

vi.mock("../api/statistics-api", () => ({
  getStatisticsOverview: vi.fn(),
  getStatisticsTimeSeries: vi.fn(),
  getStatisticsWorkTypes: vi.fn()
}));

import { listWorkTypes } from "../../../api/endpoints";
import {
  getStatisticsOverview,
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

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  });

  return render(
    <MemoryRouter>
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
  });

  it("renders backend summary, chart and breakdown", async () => {
    renderPage();

    expect(await screen.findAllByText("€3,482")).toHaveLength(2);
    expect(screen.getByText("+18%")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Gross income trend chart" })).toBeInTheDocument();
    expect(screen.getAllByText("Check")).toHaveLength(2);
    expect(screen.getByText("72h · 100%")).toBeInTheDocument();
    expect(screen.getAllByText("€3,482")).toHaveLength(2);
    expect(screen.getByText("Heatmap comes next")).toBeInTheDocument();
  });

  it("refetches statistics when filters change", async () => {
    renderPage();
    const user = userEvent.setup();

    await screen.findAllByText("€3,482");
    await user.selectOptions(screen.getByLabelText("Metric"), "WORKED_HOURS");
    await user.selectOptions(screen.getByLabelText("Calculation method"), "TIME_BASED");
    await user.selectOptions(screen.getByLabelText("Work type"), "work-type-check");

    await waitFor(() => {
      expect(getStatisticsOverview).toHaveBeenCalledWith(
        expect.objectContaining({
          metric: "WORKED_HOURS",
          calculationMethods: ["TIME_BASED"],
          workTypeIds: ["work-type-check"]
        })
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
});

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
  grossAmount: "3482.00",
  currency: "EUR",
  workedMinutes: "4320",
  workedDays: 12,
  entries: 18,
  averageMinutesPerDay: "360",
  comparisonPercentage: "18.00",
  comparisonDirection: "UP" as const
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
    vi.mocked(getStatisticsTimeSeries).mockResolvedValue([
      { date: "2026-07-01", value: "1200" },
      { date: "2026-07-02", value: "2282" }
    ]);
    vi.mocked(getStatisticsWorkTypes).mockResolvedValue([
      {
        workTypeId: "work-type-check",
        name: "Check",
        minutes: "4320",
        gross: "3482",
        percentage: "100",
        entries: 18
      }
    ]);
  });

  it("renders backend summary, chart and breakdown", async () => {
    renderPage();

    expect(await screen.findByText("€3,482")).toBeInTheDocument();
    expect(screen.getByText("+18%")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Gross income trend chart" })).toBeInTheDocument();
    expect(screen.getAllByText("Check")).toHaveLength(2);
    expect(screen.getByText("72h · 100%")).toBeInTheDocument();
    expect(screen.getByText("Heatmap comes next")).toBeInTheDocument();
  });

  it("refetches statistics when filters change", async () => {
    renderPage();
    const user = userEvent.setup();

    await screen.findByText("€3,482");
    await user.selectOptions(screen.getByLabelText("Calculation method"), "TIME_BASED");
    await user.selectOptions(screen.getByLabelText("Work type"), "work-type-check");

    await waitFor(() => {
      expect(getStatisticsOverview).toHaveBeenCalledWith(
        expect.objectContaining({
          calculationMethods: ["TIME_BASED"],
          workTypeIds: ["work-type-check"]
        })
      );
    });
  });

  it("shows the empty state when the backend has no entries", async () => {
    vi.mocked(getStatisticsOverview).mockResolvedValueOnce({
      ...overview,
      grossAmount: "0",
      workedMinutes: "0",
      workedDays: 0,
      entries: 0,
      averageMinutesPerDay: "0",
      comparisonPercentage: "0",
      comparisonDirection: "FLAT"
    });
    vi.mocked(getStatisticsTimeSeries).mockResolvedValueOnce([]);
    vi.mocked(getStatisticsWorkTypes).mockResolvedValueOnce([]);

    renderPage();

    expect(await screen.findByText("No statistics yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Entry" })).toBeInTheDocument();
  });
});

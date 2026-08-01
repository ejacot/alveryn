import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { StatisticsPage } from "./statistics-page";

vi.mock("../../../api/endpoints", () => ({
  listWorkTypes: vi.fn(async () => []),
  listEmployments: vi.fn(async () => [])
}));

vi.mock("../hooks/use-statistics", () => ({
  useStatistics: vi.fn(() => ({
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    overview: {
      data: {
        entries: 4,
        grossByCurrency: [{ currency: "EUR", amount: "640" }]
      }
    },
    timeSeries: {
      data: {
        metric: "GROSS",
        granularity: "DAILY",
        points: []
      }
    },
    workTypes: { data: [] },
    insights: { data: null, isLoading: false, isError: false, refetch: vi.fn() },
    forecast: { data: null, isLoading: false, isError: false, refetch: vi.fn() },
    productivity: { data: null, isLoading: false, isError: false, refetch: vi.fn() },
    highlights: { data: null, isLoading: false, isError: false, refetch: vi.fn() },
    heatmap: { data: null, isLoading: false, isError: false, refetch: vi.fn() }
  }))
}));

vi.mock("../components/statistics-filter-bar", () => ({
  StatisticsFilterBar: () => <div>Statistics filters</div>
}));
vi.mock("../components/statistics-summary", () => ({
  StatisticsPrimarySummary: () => <div>Primary summary</div>,
  StatisticsSummaryCards: () => <div>Summary cards</div>
}));
vi.mock("../charts/statistics-line-chart", () => ({
  StatisticsLineChart: () => <div>Trend chart</div>
}));
vi.mock("../components/statistics-drilldown-panel", () => ({
  StatisticsDrilldownPanel: () => null
}));
vi.mock("../components/statistics-comparison-panel", () => ({
  StatisticsComparisonPanel: () => <div>Period comparison</div>
}));
vi.mock("../components/work-type-breakdown", () => ({
  WorkTypeBreakdown: () => <div>Work type breakdown</div>
}));
vi.mock("../components/statistics-heatmap", () => ({
  StatisticsHeatmap: () => <div>Activity heatmap</div>
}));
vi.mock("../components/statistics-v2b-sections", () => ({
  StatisticsInsightsSection: () => <div>Insights</div>,
  StatisticsForecastSection: () => <div>Forecast</div>,
  StatisticsProductivitySection: () => <div>Productivity</div>,
  StatisticsHighlightsSection: () => <div>Highlights</div>
}));

describe("StatisticsPage", () => {
  it("renders the complete statistics workspace", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });

    render(
      <MemoryRouter initialEntries={["/statistics"]}>
        <QueryClientProvider client={queryClient}>
          <StatisticsPage />
        </QueryClientProvider>
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Statistics" })).toBeInTheDocument();
    expect(screen.getByText("Statistics filters")).toBeInTheDocument();
    expect(screen.getByText("Primary summary")).toBeInTheDocument();
    expect(screen.getByText("Trend chart")).toBeInTheDocument();
    expect(screen.getByText("Forecast")).toBeInTheDocument();
    expect(screen.getByText("Productivity")).toBeInTheDocument();
    expect(screen.getByText("Activity heatmap")).toBeInTheDocument();
    expect(screen.queryByText("Coming soon")).not.toBeInTheDocument();
  });
});
